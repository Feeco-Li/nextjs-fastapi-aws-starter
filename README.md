# fastapi-cdk-starter

A production-ready AWS backend starter — FastAPI + Amazon Cognito + DynamoDB, deployed with AWS CDK.

## Stack

| Layer | Technology |
|---|---|
| Auth | Amazon Cognito User Pool |
| Backend | FastAPI on Lambda (x86_64, Python 3.13) via Mangum |
| API | HTTP API Gateway v2 — JWT Authorizer (Cognito) |
| Database | Amazon DynamoDB |
| Infrastructure | AWS CDK (TypeScript) |
| Package manager | uv (Python), npm (Node) |

## Project Structure

```
.
├── pyproject.toml              # Python deps (uv)
├── handler.py                  # Lambda entry: Mangum(app)
├── app/
│   ├── main.py                 # FastAPI app + CORS middleware
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
        ├── auth.ts             # Cognito User Pool + Client
        ├── database.ts         # DynamoDB tables
        └── api.ts              # Lambda + API Gateway + JWT Authorizer
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

After deploy, run `make outputs` to print stack values and write `.env` for local development:

```bash
make outputs
```

Copy the printed values into your frontend's environment variables:

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

`make dev` auto-loads `.env` — run `make outputs` once after deploying to generate it.
AWS credentials must be configured (`aws configure`) so boto3 can reach DynamoDB.

---

## Tear Down

```bash
make destroy
```

---

## All Commands

```bash
make install   # install all dependencies (npm + uv)
make dev       # run FastAPI locally on :8000
make deploy    # deploy / redeploy CDK stack
make destroy   # tear down all AWS resources
make outputs   # print stack outputs + write .env for local dev
```

> `Makefile` is used instead of `package.json` scripts because this is a mixed Python + TypeScript project.
> `make` is language-agnostic, requires no runtime, and is pre-installed on macOS and Linux.

---

## Customisation

### Add a new DynamoDB table

1. **`lib/constructs/database.ts`** — add the table (uncomment the placeholder):
   ```typescript
   readonly ordersTable: dynamodb.Table;

   this.ordersTable = new dynamodb.Table(this, 'OrdersTable', {
     tableName: `${stackName}-orders`,
     partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
     billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
     removalPolicy: cdk.RemovalPolicy.DESTROY,
   });
   ```

2. **`lib/constructs/api.ts`** — inject env var and grant access (uncomment the placeholders):
   ```typescript
   environment: {
     ORDERS_TABLE: database.ordersTable.tableName,
   },
   // ...
   database.ordersTable.grantReadWriteData(apiFn);
   ```

3. **`app/routes/orders.py`** — new route file:
   ```python
   import boto3
   from fastapi import APIRouter
   from pydantic_settings import BaseSettings

   class Settings(BaseSettings):
       orders_table: str
       model_config = {"env_file": ".env", "extra": "ignore"}

   router = APIRouter(tags=["orders"])
   table = boto3.resource("dynamodb").Table(Settings().orders_table)

   @router.get("/orders")
   async def list_orders():
       return table.scan()["Items"]
   ```

4. **`app/main.py`** — register the router:
   ```python
   from app.routes import orders
   app.include_router(orders.router, prefix="/api/v1")
   ```

5. `make deploy` — creates the table, existing tables are untouched
6. `make outputs` — rewrites `.env` with the new table name included

### Add a protected API route

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
3. `make deploy`

All `/{proxy+}` routes are automatically protected by the JWT Authorizer — no extra config needed.

### Add a public route

In `lib/constructs/api.ts`, declare the route before the catch-all:
```typescript
api.addRoutes({ path: '/products', methods: [apigwv2.HttpMethod.GET], integration });
```
