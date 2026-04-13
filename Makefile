.PHONY: install deploy deploy-frontend destroy outputs dev-backend dev-frontend

STACK_NAME ?= nextjs-fastapi-template
REGION     ?= us-east-1

# ── Setup ────────────────────────────────────────────────────────────────────
install:
	@echo "→ Installing CDK deps..."
	cd infra && npm install
	@echo "→ Installing frontend deps..."
	cd frontend && npm install
	@echo "→ Installing backend deps (uv)..."
	cd backend && uv sync

# ── Deploy ────────────────────────────────────────────────────────────────────
deploy:
	@echo "→ Deploying CDK stack '$(STACK_NAME)' to $(REGION)..."
	cd infra && npx cdk deploy --require-approval never
	@echo "→ Writing frontend/.env.local from stack outputs..."
	./scripts/post-deploy.sh $(STACK_NAME) $(REGION)

deploy-frontend:
	@echo "→ Building frontend static export..."
	cd frontend && npm run build
	@echo "→ Deploying to Amplify..."
	./scripts/deploy-frontend.sh $(REGION)

# ── Teardown ──────────────────────────────────────────────────────────────────
destroy:
	@if [ -f .amplify-app-id ]; then \
		APP_ID=$$(cat .amplify-app-id); \
		echo "→ Deleting Amplify app $$APP_ID..."; \
		aws amplify delete-app --app-id $$APP_ID --region $(REGION) 2>/dev/null || true; \
		rm -f .amplify-app-id; \
	fi
	@echo "→ Destroying CDK stack..."
	cd infra && npx cdk destroy --force

# ── Utilities ────────────────────────────────────────────────────────────────
outputs:
	@aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) \
		--region $(REGION) \
		--query "Stacks[0].Outputs" \
		--output table

# ── Local Development ────────────────────────────────────────────────────────
dev-backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev
