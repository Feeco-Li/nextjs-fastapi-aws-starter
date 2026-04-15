# fastapi-cdk-starter

FastAPI + Amazon Cognito + Aurora PostgreSQL on AWS, deployed via AWS CDK.
Frontend is deployed separately (e.g. Next.js on Amplify, configured manually with CDK outputs).

---

## Architecture

```
Browser / Frontend
  │  Authorization: Bearer <Cognito access token>
  ▼
Amazon API Gateway (HTTP API v2)
  │  JWT Authorizer validates token — Lambda never runs for bad tokens
  ▼
AWS Lambda (FastAPI via Mangum)
  │  stateless, zero auth logic
  │  inside VPC — reads Aurora credentials from Secrets Manager
  ▼
Aurora Serverless v2 (PostgreSQL 16)
  └── private VPC subnet — no public endpoint
```

| Layer | Technology | Key decision |
|---|---|---|
| Auth provider | Amazon Cognito User Pool | email/password, SRP flow, no app-client secret |
| API auth | API Gateway JWT Authorizer | Cognito public keys, validated before Lambda |
| Backend | FastAPI + Mangum | stateless, no sessions, no login endpoints |
| Database | Aurora Serverless v2 (PostgreSQL 16) | scales 0.5-4 ACU, credentials in Secrets Manager |
| Networking | VPC (isolated subnets) + Secrets Manager endpoint | Lambda reaches Aurora + Secrets Manager without internet |
| Package manager | uv | Python deps via `pyproject.toml` |
| IaC | **AWS CDK** (TypeScript) | type-safe, single `cdk deploy` + `cdk destroy` |
| Runtime | Python 3.13 / x86_64 | compatible with standard x86 dev machines |

---

## File Structure

```
.
├── pyproject.toml              # Python deps (uv) — FastAPI, Mangum, Pydantic, boto3, SQLAlchemy
├── handler.py                  # Lambda entry: Mangum(app)
├── app/
│   ├── main.py                 # FastAPI app + CORS middleware + lifespan (init_db)
│   ├── database.py             # SQLAlchemy engine, models, init_db
│   └── routes/
│       ├── health.py           # GET /health — public (no authorizer)
│       └── items.py            # CRUD /api/v1/items — protected (JWT required)
├── package.json                # CDK deps (npm)
├── tsconfig.json
├── cdk.json                    # CDK entry: bin/app.ts via ts-node
├── bin/
│   └── app.ts                  # CDK app — instantiates MainStack
└── lib/
    ├── stack.ts                # Composes constructs + CfnOutputs
    └── constructs/
        ├── network.ts          # VPC + Secrets Manager VPC endpoint
        ├── auth.ts             # Cognito User Pool + Client
        ├── database.ts         # Aurora Serverless v2 cluster
        └── api.ts              # Lambda (in VPC) + API Gateway + JWT Authorizer
```

---

## Commands

All commands are in the `Makefile` — language-agnostic, no extra runtime required.
Prefer `make` over `npm run` or raw CLI commands in this project (mixed Python + TypeScript).

```bash
make install   # npm install + uv sync
make dev       # uvicorn on :8000 (auto-loads .env)
make deploy    # npx cdk deploy --require-approval never
make destroy   # npx cdk destroy
make outputs   # print CloudFormation outputs + write .env (run after deploy)
```

---

## CDK Constructs (lib/constructs/)

The stack is split into four constructs. Each owns one slice of infrastructure
and exposes what others need via public properties.

```
stack.ts
  ├── NetworkConstruct  → vpc
  ├── AuthConstruct     → userPool, userPoolClient
  ├── DatabaseConstruct → cluster, securityGroup
  │     takes: { vpc }
  │     creates: Aurora Serverless v2 cluster + security group
  │     stores: credentials auto-generated in Secrets Manager
  └── ApiConstruct      → apiUrl
        takes: { auth, database, vpc }
        creates: Lambda (in VPC) + API Gateway
        grants: cluster.secret.grantRead(apiFn)
        injects: DB_SECRET_ARN, DB_HOST, DB_PORT, DB_NAME env vars
```

**Deploy flow:**
```
cdk deploy
  ├── ts-node compiles constructs + stack
  ├── CDK synthesizes CloudFormation template → cdk.out/
  ├── Docker bundles Lambda (pip install . + cp handler.py app/)
  ├── Uploads zip to CDKToolkit S3 bucket
  └── CloudFormation creates/updates all resources
```

**Bootstrap requirement:** First-ever CDK deploy needs:
```bash
npx cdk bootstrap
```
One-time per account/region. Creates the `CDKToolkit` stack.

---

## Database Connection

**On Lambda (automatic):**
- `DATABASE_URL` is not set → falls back to Secrets Manager
- Lambda reads Aurora credentials via `DB_SECRET_ARN` env var (injected by CDK)
- Lambda is inside the VPC → can reach Aurora directly
- No manual configuration needed

**Local dev:**
- Aurora has no public endpoint — cannot connect from outside the VPC
- Set `DATABASE_URL` in `.env` pointing to a local PostgreSQL or Neon
- `make dev` auto-loads `.env`

```
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/appdb
```

---

## Stack Outputs → Frontend Variables

After `make deploy`, run `make outputs` to print values and write `.env`:

| CDK Output | Frontend Env Var |
|---|---|
| `UserPoolId` | `NEXT_PUBLIC_USER_POOL_ID` |
| `UserPoolClientId` | `NEXT_PUBLIC_USER_POOL_CLIENT_ID` |
| `ApiUrl` | `NEXT_PUBLIC_API_URL` |
| `Region` | `NEXT_PUBLIC_AWS_REGION` |

`DATABASE_URL` is not in outputs — set it manually in `.env` for local dev.

---

## Adding a New PostgreSQL Model

**1. `app/database.py`** — add the SQLAlchemy model:
```python
class OrderModel(Base):
    __tablename__ = "orders"

    id          = Column(String, primary_key=True)
    item_id     = Column(String, nullable=False)
    quantity    = Column(Integer, nullable=False)
```

**2. `app/routes/orders.py`** — new route file:
```python
from fastapi import APIRouter
from sqlalchemy.orm import Session
from app.database import get_engine, OrderModel

router = APIRouter(tags=["orders"])

@router.get("/orders")
def list_orders():
    with Session(get_engine()) as session:
        return session.query(OrderModel).all()
```

**3. Register in `app/main.py`**:
```python
from app.routes import orders
app.include_router(orders.router, prefix="/api/v1")
```

**4. `make deploy`** — `init_db()` runs on Lambda startup and creates the new table automatically.

No CDK changes needed — all models share the same Aurora cluster.

---

## Adding a New Protected API Route

1. Create `app/routes/myroute.py`:
   ```python
   from fastapi import APIRouter
   router = APIRouter(tags=["myroute"])

   @router.get("/my-resource")
   def get_resource():
       return {"data": "..."}
   ```
2. Register in `app/main.py`:
   ```python
   from app.routes import myroute
   app.include_router(myroute.router, prefix="/api/v1")
   ```
3. `make deploy`

All `/{proxy+}` routes are automatically protected by the JWT Authorizer.

---

## Adding a Public Route

In `lib/constructs/api.ts`, add an explicit route before the catch-all:
```typescript
api.addRoutes({ path: '/products', methods: [apigwv2.HttpMethod.GET], integration });
```

---

## Known CORS Gotcha (fixed in api.ts)

**Root cause:** `HttpMethod.ANY` on `/{proxy+}` catches OPTIONS requests and applies
the JWT Authorizer → OPTIONS returns `401` → browser blocks the request.

**Fix:** Explicit `OPTIONS /{proxy+}` route without an authorizer, declared before `ANY`.
More specific method routes beat `ANY` in API Gateway v2.

---

## Key Constraints

- **No auth logic in FastAPI** — do not add JWT decode, session middleware, or login endpoints.
  The contract: if Lambda runs, the request is authenticated.
- **Lambda bundling uses Docker** — `cdk deploy` requires Docker running locally.
  Bundling installs from `pyproject.toml` and copies only `handler.py` + `app/`.
- **Aurora is private** — no public endpoint. Local dev needs a separate `DATABASE_URL`.
- **Credentials in Secrets Manager** — never hardcode DB credentials. CDK manages them automatically.
- **`init_db()` runs on every cold start** — uses SQLAlchemy `create_all` (safe to run repeatedly).
- **CDKToolkit stack** — required one-time bootstrap per account/region. Do not delete between deploys.
- **`cdk.out/` is generated** — never commit it.
- **No `__init__.py` files** — Python 3.13 supports implicit namespace packages.
- **boto3 is bundled** in the Lambda zip (listed in `pyproject.toml` dependencies) — used for Secrets Manager.
- **Security group descriptions** must be ASCII only — AWS rejects non-ASCII characters.
