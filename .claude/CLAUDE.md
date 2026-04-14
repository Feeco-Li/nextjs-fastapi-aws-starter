# fastapi-cdk-starter

FastAPI + Amazon Cognito on AWS, deployed via AWS CDK.
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
(your data layer)
```

| Layer | Technology | Key decision |
|---|---|---|
| Auth provider | Amazon Cognito User Pool | email/password, SRP flow, no app-client secret |
| API auth | API Gateway JWT Authorizer | Cognito public keys, validated before Lambda |
| Backend | FastAPI + Mangum | stateless, no sessions, no login endpoints |
| Package manager | uv | Python deps via `pyproject.toml` |
| IaC | **AWS CDK** (TypeScript) | type-safe, single `cdk deploy` + `cdk destroy` |
| Runtime | Python 3.13 / arm64 (Graviton2) | cheaper + faster cold starts |

---

## File Structure

```
.
├── pyproject.toml          # Python deps (uv) — FastAPI, Mangum, Pydantic
├── handler.py              # Lambda entry: Mangum(app)
├── app/
│   ├── main.py             # FastAPI app + CORS middleware
│   └── routes/
│       ├── health.py       # GET /health — public (no authorizer)
│       └── items.py        # GET /api/v1/items, /api/v1/items/{id} — protected
├── package.json            # CDK deps (npm)
├── tsconfig.json
├── cdk.json                # CDK entry: bin/app.ts via ts-node
├── bin/
│   └── app.ts              # CDK app — instantiates MainStack
└── lib/
    └── stack.ts            # All AWS resources defined here
```

---

## Commands

```bash
# Install deps
npm install          # CDK
uv sync              # FastAPI (local dev only)

# Deploy backend
npx cdk deploy --require-approval never

# Destroy
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

## CDK Stack (lib/stack.ts)

All AWS resources in one TypeScript file. CDK handles:
- **Lambda bundling** — spins up Docker, runs `pip install .` (reads pyproject.toml), copies `handler.py` and `app/` into the zip. No requirements.txt needed.
- **Typed references** — `userPool.userPoolId`, `api.url` instead of string interpolation.
- **RemovalPolicy.DESTROY** on Cognito User Pool — cleans up on `cdk destroy`.

```
cdk deploy
  │
  ├── ts-node compiles stack.ts
  ├── CDK synthesizes CloudFormation template → cdk.out/
  ├── Docker bundles Lambda (pip install . + cp handler.py app/)
  ├── Uploads zip to CDKToolkit S3 bucket
  └── CloudFormation creates/updates the stack
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

## Adding a New Protected Route

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

In `lib/stack.ts`, add an explicit route without an authorizer before the catch-all:
```typescript
api.addRoutes({ path: '/products', methods: [HttpMethod.GET], integration });
```

---

## Known CORS Gotcha (fixed in stack.ts)

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
- **CDKToolkit stack** — required one-time bootstrap per account/region. Do not delete between deploys.
- **`cdk.out/` is generated** — never commit it.
- **No `__init__.py` files** — Python 3.13 supports implicit namespace packages. `app/` and `app/routes/` are recognized as packages without them.
