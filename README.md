# fastapi-cdk-starter

A production-ready AWS backend starter — FastAPI + Amazon Cognito + DynamoDB, deployed with AWS CDK.

## Stack

| Layer | Technology |
|---|---|
| Auth | Amazon Cognito User Pool |
| Backend | FastAPI on Lambda (arm64, Python 3.13) via Mangum |
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
npx cdk bootstrap aws://<account-id>/us-east-1
```

### 2. Install dependencies

```bash
npm install    # CDK
uv sync        # FastAPI (local dev)
```

### 3. Deploy

```bash
npx cdk deploy --require-approval never
```

After deploy, CDK prints four output values — copy them into your frontend's environment variables:

```
UserPoolId        →  NEXT_PUBLIC_USER_POOL_ID
UserPoolClientId  →  NEXT_PUBLIC_USER_POOL_CLIENT_ID
ApiUrl            →  NEXT_PUBLIC_API_URL
Region            →  NEXT_PUBLIC_AWS_REGION
```

---

## Local Development

```bash
uv run uvicorn app.main:app --reload --port 8000
```

Swagger UI: http://localhost:8000/docs

> Note: DynamoDB routes require `TABLE_NAME` env var and AWS credentials.
> Point at a real AWS table or use [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html).

---

## Tear Down

```bash
npx cdk destroy
```

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
   import os, boto3
   from fastapi import APIRouter
   router = APIRouter(tags=["orders"])
   table = boto3.resource("dynamodb").Table(os.environ["ORDERS_TABLE"])

   @router.get("/orders")
   async def list_orders():
       return table.scan()["Items"]
   ```

4. **`app/main.py`** — register the router:
   ```python
   from app.routes import orders
   app.include_router(orders.router, prefix="/api/v1")
   ```

5. Redeploy: `npx cdk deploy --require-approval never`

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
3. Redeploy: `npx cdk deploy --require-approval never`

All `/{proxy+}` routes are automatically protected by the JWT Authorizer — no extra config needed.

### Add a public route

In `lib/constructs/api.ts`, declare the route before the catch-all:
```typescript
api.addRoutes({ path: '/products', methods: [apigwv2.HttpMethod.GET], integration });
```
