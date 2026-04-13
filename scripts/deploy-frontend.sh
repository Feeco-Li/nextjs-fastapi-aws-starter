#!/usr/bin/env bash
# Deploys the Next.js static export to Amplify (manual deployment, no Git).
# Creates the Amplify app on first run and saves the ID to .amplify-app-id.
# Usage: ./scripts/deploy-frontend.sh [region]
set -euo pipefail

REGION="${1:-us-east-1}"
APP_ID_FILE=".amplify-app-id"
OUT_DIR="frontend/out"
ZIP_FILE="frontend-dist.zip"

# ── Get or create Amplify app ─────────────────────────────────────────────────
if [[ -f "$APP_ID_FILE" ]]; then
  APP_ID=$(cat "$APP_ID_FILE")
  echo "→ Using existing Amplify app: $APP_ID"
else
  echo "→ Creating new Amplify app..."
  APP_ID=$(aws amplify create-app \
    --name "nextjs-fastapi-frontend" \
    --region "$REGION" \
    --query "app.appId" --output text)

  echo "$APP_ID" > "$APP_ID_FILE"

  aws amplify create-branch \
    --app-id "$APP_ID" \
    --branch-name main \
    --region "$REGION" > /dev/null

  # SPA rewrite rule — use Python to avoid shell escaping issues with the regex
  python3 -c "
import subprocess, json
rules = [{'source': '/<*>', 'target': '/index.html', 'status': '404-200'}]
subprocess.run([
  'aws', 'amplify', 'update-app',
  '--app-id', '$APP_ID',
  '--region', '$REGION',
  '--custom-rules', json.dumps(rules)
], check=True, capture_output=True)
"
  echo "  Created: $APP_ID (saved to $APP_ID_FILE)"
fi

# ── Zip static export ─────────────────────────────────────────────────────────
echo "→ Zipping $OUT_DIR..."
cd "$OUT_DIR"
python3 -c "
import zipfile, os
with zipfile.ZipFile('../../$ZIP_FILE', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('.'):
        for file in files:
            filepath = os.path.join(root, file)
            zf.write(filepath, filepath)
print('  ' + str(os.path.getsize('../../$ZIP_FILE') // 1024) + ' KB')
"
cd - > /dev/null

# ── Upload & deploy ───────────────────────────────────────────────────────────
echo "→ Creating deployment..."
DEPLOY=$(aws amplify create-deployment \
  --app-id "$APP_ID" \
  --branch-name main \
  --region "$REGION" \
  --output json)

JOB_ID=$(echo "$DEPLOY" | python3 -c "import sys,json; print(json.load(sys.stdin)['jobId'])")
ZIP_URL=$(echo "$DEPLOY" | python3 -c "import sys,json; print(json.load(sys.stdin)['zipUploadUrl'])")

echo "→ Uploading (job $JOB_ID)..."
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -T "$ZIP_FILE" "$ZIP_URL")
if [[ "$HTTP" != "200" ]]; then echo "Upload failed: HTTP $HTTP"; exit 1; fi

echo "→ Starting deployment..."
aws amplify start-deployment \
  --app-id "$APP_ID" \
  --branch-name main \
  --job-id "$JOB_ID" \
  --region "$REGION" > /dev/null

echo "→ Waiting for deployment..."
for i in $(seq 1 18); do
  STATUS=$(aws amplify get-job \
    --app-id "$APP_ID" \
    --branch-name main \
    --job-id "$JOB_ID" \
    --region "$REGION" \
    --query "job.summary.status" --output text)
  echo "  [$i] $STATUS"
  if [[ "$STATUS" == "SUCCEED" ]]; then
    echo ""
    echo "✓ Frontend live: https://main.${APP_ID}.amplifyapp.com"
    rm -f "$ZIP_FILE"
    exit 0
  fi
  if [[ "$STATUS" == "FAILED" || "$STATUS" == "CANCELLED" ]]; then
    echo "Deployment $STATUS"; exit 1
  fi
  sleep 10
done

echo "Timed out waiting for deployment"
exit 1
