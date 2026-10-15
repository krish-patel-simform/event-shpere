#!/usr/bin/env bash
# PostToolUse hook: run Prettier (and ESLint --fix for code files) on the file Claude just edited.
# Never blocks: tools may not be installed yet (SETUP-1), and formatting failures must not stop the session.
set -u

file="$(jq -r '.tool_input.file_path // empty' 2>/dev/null)"
[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0

# Skip generated / vendored / secret files.
case "$file" in
  */node_modules/*|*/.next/*|*/drizzle/meta/*|*/pnpm-lock.yaml|*/package-lock.json|*/.env|*/.env.*) exit 0 ;;
esac

# Only act if the project has the tools installed.
[ -x node_modules/.bin/prettier ] || [ -x node_modules/.bin/eslint ] || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    [ -x node_modules/.bin/prettier ] && node_modules/.bin/prettier --write "$file" >/dev/null 2>&1
    [ -x node_modules/.bin/eslint ] && node_modules/.bin/eslint --fix "$file" >/dev/null 2>&1
    ;;
  *.json|*.css|*.md|*.mdx|*.yml|*.yaml)
    [ -x node_modules/.bin/prettier ] && node_modules/.bin/prettier --write "$file" >/dev/null 2>&1
    ;;
esac

exit 0
