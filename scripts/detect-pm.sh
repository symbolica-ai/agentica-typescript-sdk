#!/bin/sh
# Detects the package manager and runtime from npm_config_user_agent
# Usage:
#   sh detect-pm.sh        - returns package manager (pnpm, yarn, bun, npm)
#   sh detect-pm.sh exec   - returns exec command (pnpm exec, yarn dlx, bunx, npx)
#   sh detect-pm.sh runtime - returns runtime (bun, node)
#   sh detect-pm.sh pack   - returns pack command
#   sh detect-pm.sh all    - returns all vars for eval: eval $(sh detect-pm.sh all)

get_value() {
  mode="$1"
  case "${npm_config_user_agent:-}" in
    pnpm*)
      case "$mode" in
        exec)    echo "pnpm exec" ;;
        runtime) echo "node" ;;
        pack)    echo "pnpm pack" ;;
        *)       echo "pnpm" ;;
      esac
      ;;
    yarn*)
      case "$mode" in
        exec)    echo "yarn dlx" ;;
        runtime) echo "node" ;;
        pack)    echo "yarn pack" ;;
        *)       echo "yarn" ;;
      esac
      ;;
    bun*)
      case "$mode" in
        exec)    echo "bunx" ;;
        runtime) echo "bun" ;;
        pack)    echo "bun pm pack" ;;
        *)       echo "bun" ;;
      esac
      ;;
    *)
      case "$mode" in
        exec)    echo "npx" ;;
        runtime) echo "node" ;;
        pack)    echo "npm pack" ;;
        *)       echo "npm" ;;
      esac
      ;;
  esac
}

MODE="${1:-pm}"

if [ "$MODE" = "all" ]; then
  echo "PM=$(get_value pm);EXEC='$(get_value exec)';RT=$(get_value runtime);PACK='$(get_value pack)'"
else
  get_value "$MODE"
fi

