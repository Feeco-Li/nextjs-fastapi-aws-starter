.PHONY: install dev deploy destroy outputs

# Install all dependencies
install:
	npm install
	uv sync

# Run FastAPI locally on :8000
dev:
	uv run uvicorn app.main:app --reload --port 8000

# Deploy CDK stack
deploy:
	npx cdk deploy --require-approval never

# Tear down all AWS resources
destroy:
	npx cdk destroy

# Print stack outputs (copy these into your frontend env vars)
outputs:
	aws cloudformation describe-stacks \
		--stack-name fastapi-cdk-starter \
		--query "Stacks[0].Outputs" \
		--output table
