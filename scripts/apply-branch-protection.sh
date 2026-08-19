#!/usr/bin/env bash
#
# Apply the main-branch protection this repository expects.
#
# Branch protection lives in GitHub, not in the repo, so this script is the
# closest thing to checking it in: run it and the settings match the committed
# intent. It is idempotent - re-run it whenever the required checks change.
#
# Usage:
#   ./scripts/apply-branch-protection.sh            # apply
#   ./scripts/apply-branch-protection.sh --dry-run  # print the payload only
#   ./scripts/apply-branch-protection.sh --show     # show current protection
#
# Requires the GitHub CLI, authenticated with admin rights on the repository:
#   gh auth login && gh auth status
#
# See docs/branch-protection.md for what each setting does and why.

set -euo pipefail

OWNER="${OWNER:-henrygoldsmith07-wq}"
REPO="${REPO:-Claude-Code}"
BRANCH="${BRANCH:-main}"

# --- The single-developer decision -----------------------------------------
#
# GitHub does not let anyone approve their own pull request. On a repository
# with one developer, "require 1 approval" is therefore unsatisfiable, and the
# only way to merge is to leave admins exempt so the owner can push past every
# rule - including the failing-CI rule. That trades all the protection for one
# setting that was never enforceable.
#
# The defaults below take the opposite trade: zero required approvals, and no
# admin exemption. Pull requests are still mandatory, CI must still pass, the
# branch must still be up to date, and conversations must still be resolved -
# and none of it can be clicked past.
#
# Raise APPROVALS to 1 (and turn on CODE_OWNER_REVIEWS) the moment a second
# reviewer exists. At that point ENFORCE_ADMINS=true is still correct.
APPROVALS="${APPROVALS:-0}"
ENFORCE_ADMINS="${ENFORCE_ADMINS:-true}"
CODE_OWNER_REVIEWS="${CODE_OWNER_REVIEWS:-false}"

# --- Required status checks -------------------------------------------------
#
# These are check-run names. For GitHub Actions a check run is named after the
# job, so these are job names, not "workflow / job" display strings.
#
# Both come from .github/workflows/engineering.yml, which is deliberately free
# of `paths:` filters so that it reports on every pull request.
#
# Never add a check from a path-filtered workflow. GitHub reports no status at
# all for a workflow a filter excluded, so a required check that never arrives
# leaves the pull request blocked on a status that cannot come.
REQUIRED_CHECKS=(
  "repository-gates"
  "integration-contracts (revise-content-and-ai)"
  "integration-contracts (forq-cloud-and-migrations)"
)

MODE="apply"
case "${1:-}" in
  --dry-run) MODE="dry-run" ;;
  --show) MODE="show" ;;
  "") ;;
  *) echo "Unknown argument: $1" >&2; exit 2 ;;
esac

# --dry-run only formats a payload, so it stays useful without gh installed.
if [ "$MODE" != "dry-run" ] && ! command -v gh >/dev/null 2>&1; then
  echo "error: the GitHub CLI (gh) is required. See https://cli.github.com/" >&2
  exit 1
fi

if [ "$MODE" = "show" ]; then
  gh api "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection"
  exit 0
fi

# Build the contexts array without assuming jq is installed.
contexts=""
for check in "${REQUIRED_CHECKS[@]}"; do
  escaped=${check//\"/\\\"}
  contexts="${contexts:+${contexts},}\"${escaped}\""
done

PAYLOAD=$(cat <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": [${contexts}]
  },
  "enforce_admins": ${ENFORCE_ADMINS},
  "required_pull_request_reviews": {
    "required_approving_review_count": ${APPROVALS},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": ${CODE_OWNER_REVIEWS},
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "lock_branch": false
}
JSON
)

if [ "$MODE" = "dry-run" ]; then
  echo "PUT repos/${OWNER}/${REPO}/branches/${BRANCH}/protection"
  echo "$PAYLOAD"
  exit 0
fi

echo "Applying protection to ${OWNER}/${REPO}@${BRANCH} ..."
printf '%s' "$PAYLOAD" | gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" \
  --input - >/dev/null

echo "Applied. Effective settings:"
gh api "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" --jq '{
  required_checks: .required_status_checks.contexts,
  strict_up_to_date: .required_status_checks.strict,
  approvals: .required_pull_request_reviews.required_approving_review_count,
  dismiss_stale: .required_pull_request_reviews.dismiss_stale_reviews,
  code_owner_reviews: .required_pull_request_reviews.require_code_owner_reviews,
  conversation_resolution: .required_conversation_resolution.enabled,
  force_pushes_allowed: .allow_force_pushes.enabled,
  deletions_allowed: .allow_deletions.enabled,
  admins_exempt: (.enforce_admins.enabled | not)
}'
