# fastapi-cdk-starter

FastAPI + Amazon Cognito + DynamoDB on AWS, deployed via AWS CDK.
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
  ▼
Amazon DynamoDB
```

| Layer | Technology | Key decision |
|---|---|---|
| Auth provider | Amazon Cognito User Pool | email/password, SRP flow, no app-client secret |
| API auth | API Gateway JWT Authorizer | Cognito public keys, validated before Lambda |
| Backend | FastAPI + Mangum | stateless, no sessions, no login endpoints |
| Database | DynamoDB | PAY_PER_REQUEST billing, table name injected via env var |
| Package manager | uv | Python deps via `pyproject.toml` |
| IaC | **AWS CDK** (TypeScript) | type-safe, single `cdk deploy` + `cdk destroy` |
| Runtime | Python 3.13 / arm64 (Graviton2) | cheaper + faster cold starts |

---

## File Structure

```
.
├── pyproject.toml              # Python deps (uv) — FastAPI, Mangum, Pydantic, boto3
├── handler.py                  # Lambda entry: Mangum(app)
├── app/
│   ├── main.py                 # FastAPI app + CORS middleware
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
        ├── auth.ts             # Cognito User Pool + Client
        ├── database.ts         # DynamoDB tables
        └── api.ts              # Lambda + API Gateway + JWT Authorizer
```

---

## Commands

```bash
# Install deps
npm install          # CDK
uv sync              # FastAPI (local dev only)

# Deploy
npx cdk deploy --require-approval never

# Destroy all resources
npx cdk destroy

# Print stack outputs
aws cloudformation describe-stacks \
  --stack-name fastapi-cdk-starter \
  --query "Stacks[0].Outputs" \
  --output table

# Local development
uv run uvicorn app.main:app --reload --port 8000
```

---

## CDK Constructs (lib/constructs/)

The stack is split into three constructs. Each owns one slice of infrastructure
and exposes what others need via public properties.

```
stack.ts
  ├── AuthConstruct     → userPool, userPoolClient
  ├── DatabaseConstruct → itemsTable (+ future tables)
  └── ApiConstruct      → apiUrl
        takes: { auth, database }
        creates: Lambda + API Gateway
        grants: table.grantReadWriteData(apiFn) per table
        injects: TABLE_NAME env vars into Lambda
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
npx cdk bootstrap aws://<account-id>/us-east-1
```
One-time per account/region. Creates the `CDKToolkit` stack.

---

## Stack Outputs → Frontend Variables

After `cdk deploy`, copy these outputs into your frontend:

| CDK Output | Frontend Env Var |
|---|---|
| `UserPoolId` | `NEXT_PUBLIC_USER_POOL_ID` |
| `UserPoolClientId` | `NEXT_PUBLIC_USER_POOL_CLIENT_ID` |
| `ApiUrl` | `NEXT_PUBLIC_API_URL` |
| `Region` | `NEXT_PUBLIC_AWS_REGION` |

---

## Adding a New DynamoDB Table

**1. `lib/constructs/database.ts`** — declare and create the table:
```typescript
readonly ordersTable: dynamodb.Table;

this.ordersTable = new dynamodb.Table(this, 'OrdersTable', {
  tableName: `${stackName}-orders`,
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

**2. `lib/constructs/api.ts`** — inject env var and grant access:
```typescript
environment: {
  ORDERS_TABLE: database.ordersTable.tableName,
},
// ...
database.ordersTable.grantReadWriteData(apiFn);
```

**3. `app/routes/orders.py`** — use the table:
```python
import os, boto3
table = boto3.resource("dynamodb").Table(os.environ["ORDERS_TABLE"])
```

**4. Register in `app/main.py`** and redeploy.

---

## Adding a New Protected API Route

1. Create `app/routes/myroute.py`:
   ```python
   from fastapi import APIRouter
   router = APIRouter(tags=["myroute"])

   @router.get("/my-resource")
   async def get_resource():
       return {"data": "..."}
   ```
2. Register in `app/main.py`:
   ```python
   from app.routes import myroute
   app.include_router(myroute.router, prefix="/api/v1")
   ```
3. `npx cdk deploy --require-approval never`

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
- **DynamoDB table name** is injected as a Lambda env var by CDK — never hardcode it.
- **CDKToolkit stack** — required one-time bootstrap per account/region. Do not delete between deploys.
- **`cdk.out/` is generated** — never commit it.
- **No `__init__.py` files** — Python 3.13 supports implicit namespace packages.
- **boto3 is bundled** in the Lambda zip (listed in `pyproject.toml` dependencies) for version consistency.
