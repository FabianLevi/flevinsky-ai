#!/usr/bin/env bash
# flevinsky-ai installer
#
# Usage:
#   curl -sL https://raw.githubusercontent.com/FabianLevi/flevinsky-ai/main/scripts/install.sh | bash
#
# Options (env vars):
#   FL_METHOD=brew|pnpm|npm   Force install method (default: auto)
#
# Requires Node.js >=18 (for pnpm/npm method) or Homebrew (for brew method).

set -euo pipefail

OWNER="FabianLevi"
REPO="flevinsky-ai"
BREW_TAP="${OWNER}/tap"
PKG_NAME="flevinsky-ai"

if [ -t 1 ] && [ "${TERM:-}" != "dumb" ]; then
  G='\033[0;32m'; B='\033[0;34m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
else
  G=''; B=''; Y=''; R=''; N=''
fi

info() { printf "${B}[info]${N} %s\n" "$*"; }
ok()   { printf "${G}[ok]${N}   %s\n" "$*"; }
warn() { printf "${Y}[warn]${N} %s\n" "$*"; }
die()  { printf "${R}[err]${N}  %s\n" "$*" >&2; exit 1; }

method="${FL_METHOD:-auto}"

detect() {
  if command -v brew >/dev/null 2>&1; then echo brew; return; fi
  if command -v pnpm >/dev/null 2>&1; then echo pnpm; return; fi
  if command -v npm  >/dev/null 2>&1; then echo npm;  return; fi
  echo none
}

if [ "$method" = "auto" ]; then
  method="$(detect)"
fi

case "$method" in
  brew)
    command -v brew >/dev/null 2>&1 || die "Homebrew not found. Install from https://brew.sh"
    info "installing via Homebrew tap ${BREW_TAP}"
    brew tap "$BREW_TAP" >/dev/null
    brew install "$PKG_NAME"
    ;;
  pnpm)
    command -v pnpm >/dev/null 2>&1 || die "pnpm not found. Install from https://pnpm.io"
    info "installing via pnpm (global)"
    pnpm add -g "$PKG_NAME"
    ;;
  npm)
    command -v npm >/dev/null 2>&1 || die "npm not found. Install Node.js >=18"
    info "installing via npm (global)"
    npm install -g "$PKG_NAME"
    ;;
  none)
    die "No installer available. Install Homebrew (https://brew.sh) or Node.js >=18, then re-run."
    ;;
  *)
    die "unknown FL_METHOD: $method (use 'brew', 'pnpm', or 'npm')"
    ;;
esac

ok "$PKG_NAME installed."
info "Verify with: flevinsky-ai --help"
info "Claude Code plugin install: claude /plugin marketplace add ${OWNER}/${REPO}"
info "Pi extension install:     pi extension install ${PKG_NAME}"
