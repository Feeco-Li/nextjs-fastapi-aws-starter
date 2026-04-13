# nextjs-fastapi-template

Next.js + FastAPI + Amazon Cognito on AWS.
Backend via AWS CDK, frontend via Amplify manual deployment (no Git required).

---

## Architecture

```
Browser
  │  sign-in / sign-up / token refresh
  ▼
AWS Amplify Hosting (Next.js static export)
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
| Frontend | Next.js 14 App Router — **static export** | Amplify manual deployment (no Git required) |
| Auth UI | `@aws-amplify/ui-react` `<Authenticator>` | zero custom auth code |
| Token handling | `aws-amplify` v6 | auto-refresh, `localStorage` (static export) |
| API auth | API Gateway JWT Authorizer | Cognito public keys, validated before Lambda |
| Backend | FastAPI + Mangum | stateless, no sessions, no login endpoints |
| Package manager | uv | Python deps managed via `pyproject.toml` |
| IaC | **AWS CDK** (TypeScript) | type-safe, single `cdk deploy` + `cdk destroy` |
| Runtime | Python 3.13 / arm64 (Graviton2) | cheaper + faster cold starts |

---

## File Structure

```
.
├── Makefile                        # all commands
├── .gitignore
├── .amplify-app-id                 # auto-created by deploy-frontend.sh (gitignored)
├── scripts/
│   ├── post-deploy.sh              # reads CF outputs → writes frontend/.env.local
│   └── deploy-frontend.sh         # creates/reuses Amplify app, uploads static export
│
├── infra/                          # AWS CDK project (TypeScript)
│   ├── package.json
│   ├── tsconfig.json
│   ├── cdk.json                    # entry point: bin/app.ts via ts-node
│   ├── bin/
│   │   └── app.ts                  # CDK app — instantiates MainStack
│   └── lib/
│       └── stack.ts                # all AWS resources defined here
│
├── backend/                        # FastAPI Lambda
│   ├── pyproject.toml              # uv project (python 3.13)
│   ├── uv.lock
│   ├── handler.py                  # Lambda entry: Mangum(app)
│   └── app/
│       ├── main.py                 # FastAPI app + CORS middleware
│       └── routes/
│           ├── health.py           # GET /health — public (no authorizer)
│           └── items.py            # GET /api/v1/items, /api/v1/items/{id} — protected
│
└── frontend/                       # Next.js 14 (static export)
    ├── package.json
    ├── next.config.mjs             # output: 'export', trailingSlash: true
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── amplify.yml
    ├── .env.local.example
    └── src/
        ├── app/
        │   ├── layout.tsx                        # Providers + ConfigureAmplify
        │   ├── globals.css
        │   ├── page.tsx                          # public — Authenticator UI
        │   └── (protected)/dashboard/page.tsx   # protected — calls FastAPI
        ├── components/
        │   ├── ConfigureAmplify.tsx              # Amplify.configure() — no ssr:true
        │   └── Providers.tsx                     # Authenticator.Provider wrapper
        └── lib/
            ├── amplify-config.ts                 # reads NEXT_PUBLIC_* env vars
            └── api-client.ts                     # apiFetch / apiGet / apiPost
```

---

## Commands

```bash
# First-time setup
make install                  # npm install (infra + frontend) + uv sync (backend)

# Deploy backend (Cognito + API GW + Lambda) → also writes frontend/.env.local
make deploy

# Deploy frontend to Amplify (creates app on first run, reuses on subsequent runs)
make deploy-frontend

# Redeploy backend only after changes
cd infra && npx cdk deploy --require-approval never

# Redeploy frontend only after changes
make deploy-frontend

# Print backend stack outputs
make outputs

# Tear EVERYTHING down — Amplify app + CDK stack
make destroy

# Local development
make dev-backend              # uvicorn on :8000
make dev-frontend             # next dev on :3000 (uses .env.local → real AWS)
```

---

## CDK Stack (infra/lib/stack.ts)

All AWS resources are defined in a single TypeScript file. CDK handles:
- **Lambda bundling** — spins up a Docker container, runs `pip install`, zips output.
  No separate build step. `cdk deploy` does everything.
- **Typed references** — `userPool.userPoolId`, `api.url` instead of `!Ref`/`!Sub` strings.
- **RemovalPolicy.DESTROY** on Cognito User Pool — equivalent to `DeletionPolicy: Delete` in SAM.

```
cdk deploy
  │
  ├── ts-node compiles stack.ts
  ├── CDK synthesizes CloudFormation template → cdk.out/
  ├── Docker bundles Lambda (pip install + source copy)
  ├── Uploads zip to CDKToolkit S3 bucket
  └── CloudFormation creates/updates the stack
```

**Bootstrap requirement:** First-ever CDK deploy to an account/region needs:
```bash
cd infra && npx cdk bootstrap aws://<account-id>/us-east-1
```
This creates the `CDKToolkit` stack (S3 bucket + IAM roles). One-time per account/region.

---

## How the Auth Flow Works

1. User visits `/` → `<Authenticator>` renders sign-in/sign-up UI (no custom code).
2. On success, Amplify stores tokens in `localStorage` (static export — no `ssr: true`).
3. `RedirectWhenSignedIn` detects `user` and calls `router.replace('/dashboard')`.
4. Dashboard calls `apiGet('/api/v1/items')` → `api-client.ts` calls
   `fetchAuthSession()` to get the current access token, attaches it as
   `Authorization: Bearer <token>`.
5. API Gateway checks the JWT against Cognito's public keys.
   Invalid/missing token → `401` before Lambda is invoked.
   Valid token → Lambda runs, FastAPI handles the request.
6. When the access token expires, `fetchAuthSession()` automatically uses the
   refresh token. FastAPI never sees expired tokens.

---

## Amplify Deployment

`scripts/deploy-frontend.sh` manages the Amplify app:
- **First run** — creates the Amplify app, branch, and SPA rewrite rule.
  Saves the app ID to `.amplify-app-id` (gitignored).
- **Subsequent runs** — reads the ID from `.amplify-app-id` and redeploys.
- **Destroy** — `make destroy` reads `.amplify-app-id`, deletes the app, removes the file.

The `NEXT_PUBLIC_*` env vars are **baked into the JS bundle** during `npm run build`
from `frontend/.env.local`. Setting them on the Amplify branch is not needed for
manual deployments (only needed for Git-connected builds where Amplify rebuilds from source).

---

## Adding a New Protected Backend Route

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
3. `cd infra && npx cdk deploy --require-approval never`

All `/{proxy+}` routes are automatically protected by the JWT Authorizer in `stack.ts`.

---

## Adding a New Protected Frontend Page

Protected pages go in `src/app/(protected)/`. Standard guard pattern:

```tsx
'use client';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function MyPage() {
  const { user } = useAuthenticator((ctx) => [ctx.user]);
  const router = useRouter();
  useEffect(() => { if (!user) router.replace('/'); }, [user, router]);
  if (!user) return null;
  // ... page content
}
```

After changes: `make deploy-frontend`

---

## Known CORS Gotcha (fixed in stack.ts)

**Symptom:** "Failed to fetch" / CORS error in browser console.

**Root cause:** `HttpMethod.ANY` on `/{proxy+}` catches OPTIONS requests and applies
the JWT Authorizer → OPTIONS returns `401` → browser blocks the request.

**Fix (in stack.ts):** Explicit `OPTIONS /{proxy+}` route without an authorizer,
declared before the `ANY` route. More specific method routes beat `ANY` in API Gateway v2.

```typescript
// OPTIONS — no authorizer (CORS preflight)
api.addRoutes({ path: '/{proxy+}', methods: [HttpMethod.OPTIONS], integration });

// ALL other methods — JWT required
api.addRoutes({ path: '/{proxy+}', methods: [HttpMethod.ANY], integration, authorizer });
```

---

## Key Constraints

- **`next.config.mjs` not `.ts`** — Next.js 14.2 does not support TypeScript config files.
- **`backend/requirements.txt` is not committed** — CDK bundles deps via Docker at deploy time.
  If you need it locally (e.g. IDE autocomplete): `cd backend && uv export --no-hashes --no-dev -o requirements.txt`
- **`frontend/.env.local` is generated** by `scripts/post-deploy.sh` — never commit it.
- **`.amplify-app-id` is generated** by `scripts/deploy-frontend.sh` — never commit it.
- **No auth logic in FastAPI** — do not add JWT decode, session middleware, or login endpoints.
  The contract: if Lambda runs, the request is authenticated.
- **CDKToolkit stack** — required one-time bootstrap per account/region. Not part of the app;
  do not delete it between deployments.
- **`make destroy` removes both** — reads `.amplify-app-id` for the Amplify app,
  then runs `cdk destroy` for the backend stack.
