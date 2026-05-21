#!/usr/bin/env bash
# One-time setup: stores Porter deploy token in GitHub Actions secrets.
set -euo pipefail

REPO="${1:-sadeqhub/ChatPay-Listener}"
SECRET_NAME="${2:-PORTER_APP_12884_4188}"

echo "1. Open Porter → app chatpay-listener → Settings → Integrations → GitHub Actions"
echo "2. Copy the deploy / CI token"
echo ""
read -rsp "Paste Porter token (hidden): " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
  echo "Error: empty token" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: install GitHub CLI (gh) first" >&2
  exit 1
fi

printf '%s' "$TOKEN" | gh secret set "$SECRET_NAME" --repo "$REPO"

echo ""
echo "Secret $SECRET_NAME set on $REPO"
echo "Re-run deploy: https://github.com/$REPO/actions/workflows/porter_stack_chatpay-listener.yml"
