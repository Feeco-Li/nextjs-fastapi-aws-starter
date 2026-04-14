# fastapi-cdk-starter

A production-ready AWS backend starter — FastAPI + Amazon Cognito, deployed with AWS CDK.

## Stack

| Layer | Technology |
|---|---|
| Auth | Amazon Cognito User Pool |
| Backend | FastAPI on Lambda (arm64, Python 3.13) via Mangum |
| API | HTTP API Gateway v2 — JWT Authorizer (Cognito) |
| Infrastructure | AWS CDK (TypeScript) |
| Package manager | uv (Python), npm (Node) |

## Project Structure

```
.
├── pyproject.toml          # Python deps (uv)
├── handler.py              # Lambda entry: Mangum(app)
├── app/
│   ├── main.py             # FastAPI app + CORS middleware
│   └── routes/
│       ├── health.py       # GET /health — public
│       └── items.py        # GET /api/v1/items — protected (JWT required)
├── package.json            # CDK deps (npm)
├── tsconfig.json
├── cdk.json                # CDK entry: bin/app.ts
├── bin/
│   └── app.ts              # CDK app — instantiates MainStack
└── lib/
    └── stack.ts            # All AWS resources
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
npm install        # CDK
uv sync            # FastAPI (local dev)
```

### 3. Deploy

```bash
npx cdk deploy --require-approval never
```

CDK outputs four values — copy them into your frontend's environment variables:

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

---

## Tear Down

```bash
npx cdk destroy
```

---

## Customisation

**Add a protected route**

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

All `/{proxy+}` routes are automatically protected by the JWT Authorizer.

**Add a public route**

In `lib/stack.ts`, declare the route explicitly before the catch-all:
```typescript
api.addRoutes({ path: '/products', methods: [HttpMethod.GET], integration });
```
