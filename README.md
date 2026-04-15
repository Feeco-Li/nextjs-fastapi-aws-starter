# fastapi-cdk-starter

A production-ready AWS backend starter — FastAPI + Amazon Cognito + Aurora PostgreSQL, deployed with AWS CDK.

## Stack

| Layer | Technology |
|---|---|
| Auth | Amazon Cognito User Pool |
| Backend | FastAPI on Lambda (x86_64, Python 3.13) via Mangum |
| API | HTTP API Gateway v2 — JWT Authorizer (Cognito) |
| Database | Aurora Serverless v2 (PostgreSQL 16) |
| Networking | VPC with isolated subnets + Secrets Manager VPC endpoint |
| Infrastructure | AWS CDK (TypeScript) |
| Package manager | uv (Python), npm (Node) |

## Project Structure

```
.
├── pyproject.toml              # Python deps (uv)
├── handler.py                  # Lambda entry: Mangum(app)
├── app/
│   ├── main.py                 # FastAPI app + CORS + lifespan (init_db)
│   ├── database.py             # SQLAlchemy engine, models, init_db
│   └── routes/
│       ├── health.py           # GET /health — public
│       └── items.py            # CRUD /api/v1/items — protected (JWT required)
├── package.json                # CDK deps (npm)
├── tsconfig.json
├── cdk.json
├── bin/
│   └── app.ts                  # CDK app entry point
└── lib/
    ├── stack.ts                # Composes constructs + outputs
    └── constructs/
        ├── network.ts          # VPC + Secrets Manager endpoint
        ├── auth.ts             # Cognito User Pool + Client
        ├── database.ts         # Aurora Serverless v2 cluster
        └── api.ts              # Lambda (in VPC) + API Gateway + JWT Authorizer
```

## Prerequisites

- AWS CLI configured (`aws configure`)
- Node.js 18+
- Python 3.13+
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Docker (required by CDK to bundle Lambda dependencies)

---

## Setup

### 1. Bootstrap CDK (one-time per AWS account/region)

```bash
npx cdk bootstrap
```

### 2. Install dependencies

```bash
make install
```

### 3. Deploy

```bash
make deploy
```

### 4. Get outputs

```bash
make outputs
```

Prints stack values and writes `.env`. Copy the printed values into your frontend:

```
UserPoolId        →  NEXT_PUBLIC_USER_POOL_ID
UserPoolClientId  →  NEXT_PUBLIC_USER_POOL_CLIENT_ID
ApiUrl            →  NEXT_PUBLIC_API_URL
Region            →  NEXT_PUBLIC_AWS_REGION
```

---

## Local Development

```bash
make dev
```

Swagger UI: http://localhost:8000/docs

`make dev` auto-loads `.env`. However, Aurora has **no public endpoint** — it lives inside a private VPC. For local dev you need a separate `DATABASE_URL` pointing to a local PostgreSQL or [Neon](https://neon.tech):

```bash
# add to .env
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/appdb
```

On Lambda, `DATABASE_URL` is not set — Lambda automatically reads credentials from Secrets Manager and connects to Aurora via the VPC.

---

## Tear Down

```bash
make destroy
```

---

## All Commands

```bash
make install   # install all dependencies (npm + uv)
make dev       # run FastAPI locally on :8000 (auto-loads .env)
make deploy    # deploy / redeploy CDK stack
make destroy   # tear down all AWS resources
make outputs   # print stack outputs + write .env for local dev
```

> `Makefile` is used instead of `package.json` scripts because this is a mixed Python + TypeScript project.
> `make` is language-agnostic, requires no runtime, and is pre-installed on macOS and Linux.

---

## Customisation

### Add a new PostgreSQL model

All models share the same Aurora cluster — no CDK changes needed.

1. **`app/database.py`** — add the SQLAlchemy model:
   ```python
   class OrderModel(Base):
       __tablename__ = "orders"

       id       = Column(String, primary_key=True)
       item_id  = Column(String, nullable=False)
   ```

2. **`app/routes/orders.py`** — new route file:
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

3. **`app/main.py`** — register the router:
   ```python
   from app.routes import orders
   app.include_router(orders.router, prefix="/api/v1")
   ```

4. `make deploy` — `init_db()` runs on Lambda startup and creates the new table automatically.

### Add a protected API route

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

All `/{proxy+}` routes are automatically protected by the JWT Authorizer — no extra config needed.

### Add a public route

In `lib/constructs/api.ts`, declare the route before the catch-all:
```typescript
api.addRoutes({ path: '/products', methods: [apigwv2.HttpMethod.GET], integration });
```
