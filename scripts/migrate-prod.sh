#!/usr/bin/env bash
# Apply all post-migrations to the production database in filename order.
# Each SQL file uses IF NOT EXISTS guards, so re-running is safe.
#
# Usage:
#   export DATABASE_URL="postgresql://vitale:PASSWORD@HOST:5432/vitale"
#   ./scripts/migrate-prod.sh
#
# Or pass the URL directly:
#   DATABASE_URL="..." ./scripts/migrate-prod.sh
#
# To get the production DATABASE_URL from Terraform:
#   cd infra/terraform && terraform output -raw rds_database_url
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/lib/db/migrations/post"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  echo "  export DATABASE_URL=\"postgresql://user:pass@host:5432/dbname\"" >&2
  exit 1
fi

if ! command -v psql &>/dev/null; then
  echo "ERROR: psql is not installed. Install it with:" >&2
  echo "  brew install libpq && brew link --force libpq  (macOS)" >&2
  exit 1
fi

# Mask the password in the log output
REDACTED="${DATABASE_URL%%:*}://***@${DATABASE_URL##*@}"
echo "Applying migrations to: $REDACTED"
echo ""

APPLIED=0
FAILED=0

for sql_file in "$MIGRATIONS_DIR"/*.sql; do
  [[ -f "$sql_file" ]] || continue
  filename="$(basename "$sql_file")"
  printf "  %-55s " "$filename"
  if psql "$DATABASE_URL" -f "$sql_file" -q 2>/tmp/migrate_err; then
    echo "OK"
    APPLIED=$((APPLIED + 1))
  else
    echo "FAILED"
    cat /tmp/migrate_err >&2
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "Done. Applied: $APPLIED  Failed: $FAILED"
[[ $FAILED -eq 0 ]] || exit 1
