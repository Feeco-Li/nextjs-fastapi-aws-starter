# nextjs-fastapi-aws-starter

A production-ready AWS starter template — Next.js 14 + FastAPI + Amazon Cognito, deployed with AWS CDK.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (SSR) — Amplify Hosting |
| Auth | Amazon Cognito User Pool — pre-built UI via `@aws-amplify/ui-react` |
| Backend | FastAPI on Lambda (arm64, Python 3.13) via Mangum |
| API | HTTP API Gateway v2 — JWT Authorizer (Cognito) |
| Infrastructure | AWS CDK (TypeScript) |
| Package manager | uv (Python), npm (Node) |

## Prerequisites

- AWS CLI configured (`aws configure`)
- Node.js 18+
- Python 3.13+
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Docker (required by CDK to bundle Lambda dependencies)

---

## Setup

### 1. One-time CDK bootstrap (per AWS account/region)

```bash
cd infra && npx cdk bootstrap aws://<account-id>/us-east-1
```

### 2. Clone and install dependencies

```bash
git clone https://github.com/Feeco-Li/nextjs-fastapi-aws-starter my-project
cd my-project
make install
```

### 3. Deploy backend

```bash
make deploy
```

Creates Cognito User Pool, API Gateway, and Lambda. Writes `frontend/.env.local` with the output values automatically.

### 4. Deploy frontend

**Option A — GitHub-connected Amplify (recommended)**

Push to your own GitHub repo, then connect it in Amplify Console:

1. Amplify Console → New app → Host web app → Connect GitHub repo
2. App settings → Environment variables → add the 4 values from `frontend/.env.local`:
   ```
   NEXT_PUBLIC_AWS_REGION
   NEXT_PUBLIC_USER_POOL_ID
   NEXT_PUBLIC_USER_POOL_CLIENT_ID
   NEXT_PUBLIC_API_URL
   ```
3. Amplify builds and deploys automatically on every push to `main`

**Option B — Manual upload (no GitHub required)**

```bash
make deploy-frontend
```

Creates an Amplify app, builds Next.js, and uploads the output. Prints the live URL when done.

---

## Local development

```bash
make dev-backend    # FastAPI on localhost:8000
make dev-frontend   # Next.js on localhost:3000 (uses real AWS backend via .env.local)
```

---

## Tear down

```bash
make destroy
# Deletes Amplify app + CDK stack (Cognito, API Gateway, Lambda)
```

---

## Customisation

**Add a protected backend route**

1. Create `backend/app/routes/myroute.py`:
   ```python
   from fastapi import APIRouter
   router = APIRouter(tags=["myroute"])

   @router.get("/my-resource")
   async def get_resource():
       return {"data": "..."}
   ```
2. Register in `backend/app/main.py`:
   ```python
   from app.routes import myroute
   app.include_router(myroute.router, prefix="/api/v1")
   ```
3. Redeploy: `cd infra && npx cdk deploy --require-approval never`

**Add a public backend route**

In `infra/lib/stack.ts`, declare the route explicitly before the catch-all:
```typescript
api.addRoutes({ path: '/products', methods: [HttpMethod.GET], integration });
```

**Add a protected frontend page**

1. Create page under `src/app/(protected)/mypage/page.tsx`
2. Add the path to `src/middleware.ts`:
   ```typescript
   export const config = {
     matcher: ['/dashboard/:path*', '/mypage/:path*'],
   };
   ```

**Make an API call from the frontend**

```typescript
import apiClient from '@/lib/api-client';

const { data } = await apiClient.get('/api/v1/my-resource');
const result = await apiClient.post('/api/v1/my-resource', { key: 'value' });
```

`apiClient` attaches the Cognito Bearer token automatically on every request.

---

## All commands

```bash
make install          # Install all dependencies (infra + frontend + backend)
make deploy           # Deploy CDK stack + write frontend/.env.local
make deploy-frontend  # Build and deploy frontend to Amplify (manual mode)
make destroy          # Delete Amplify app + CDK stack
make outputs          # Print CDK stack outputs
make dev-backend      # Run FastAPI locally on :8000
make dev-frontend     # Run Next.js locally on :3000
```
