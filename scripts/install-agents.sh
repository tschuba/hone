#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/msitarzewski/agency-agents.git"
DEST="${HOME}/.claude/agents"

WHITELIST=(
  "engineering/engineering-software-architect.md"
  "engineering/engineering-backend-architect.md"
  "engineering/engineering-frontend-developer.md"
  "engineering/engineering-database-optimizer.md"
  "engineering/engineering-security-engineer.md"
  "engineering/engineering-devops-automator.md"
  "engineering/engineering-senior-developer.md"
  "engineering/engineering-code-reviewer.md"
  "engineering/engineering-technical-writer.md"
  "engineering/engineering-minimal-change-engineer.md"
  "engineering/engineering-rapid-prototyper.md"
  "engineering/engineering-sre.md"
  "engineering/engineering-ai-engineer.md"
  "design/design-ux-architect.md"
  "design/design-ui-designer.md"
  "design/design-ux-researcher.md"
  "design/design-inclusive-visuals-specialist.md"
  "design/design-brand-guardian.md"
  "testing/testing-api-tester.md"
  "testing/testing-accessibility-auditor.md"
  "testing/testing-performance-benchmarker.md"
  "testing/testing-reality-checker.md"
  "testing/testing-evidence-collector.md"
)

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "Cloning agency-agents..."
git clone --depth 1 --quiet "$REPO_URL" "$TMPDIR/agency-agents"

mkdir -p "$DEST"

count=0
for file in "${WHITELIST[@]}"; do
  src="$TMPDIR/agency-agents/$file"
  if [[ -f "$src" ]]; then
    cp "$src" "$DEST/"
    (( count++ )) || true
  else
    echo "WARNING: not found: $file" >&2
  fi
done

echo "Done. $count agents installed to $DEST"
