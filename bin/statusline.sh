#!/usr/bin/env bash
# Statusline script: renders chips for running services.
# Wire from ~/.claude/settings.json:
#   { "statusLine": { "type": "command", "command": "/abs/path/to/flevinsky-ai/bin/statusline.sh" } }
#
# Reads state.json from the cwd Claude reports on stdin, walking up to find
# a project root containing one of: .flevinsky-ai .services .pi .claude.

set -euo pipefail

stdin=$(cat)
cwd=$(printf '%s' "$stdin" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).cwd||"")}catch{process.stdout.write("")}})')
[ -z "$cwd" ] && cwd=$(pwd)

state=""
cur="$cwd"
while :; do
  for dir in .flevinsky-ai .services .pi .claude; do
    if [ -f "$cur/$dir/services/state.json" ]; then
      state="$cur/$dir/services/state.json"
      break 2
    fi
  done
  parent=$(dirname "$cur")
  [ "$parent" = "$cur" ] && break
  cur="$parent"
done

[ -z "$state" ] && exit 0

node -e '
const fs=require("fs");
try{
  const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  const visible=Object.entries(s).filter(([,e])=>["running","starting","stopping"].includes(e.status));
  if(visible.length===0)return;
  const glyph={running:"●",starting:"◐",stopping:"◓"};
  process.stdout.write(visible.map(([n,e])=>`${glyph[e.status]||"·"} ${n}`).join("  "));
}catch{}' "$state"
