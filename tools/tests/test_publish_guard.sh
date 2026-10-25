#!/usr/bin/env bash
# Success case on the real tree, plus failure cases on a temp copy.
# Each failure case must make the guard exit non-zero.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GUARD="$ROOT/tools/publish_guard.py"
fails=0

expect() {  # expect <want_rc> <label> <cmd...>
  local want=$1 label=$2; shift 2
  "$@" >/tmp/guard_out.txt 2>&1; local rc=$?
  if [ "$rc" -eq "$want" ]; then echo "PASS  $label (rc=$rc)"
  else echo "FAIL  $label (want=$want got=$rc)"; cat /tmp/guard_out.txt; fails=$((fails+1)); fi
}

expect 0 "success: ep15 on current tree" python3 "$GUARD" --root "$ROOT" --ep 15

TMP=$(mktemp -d)
copy() { rm -rf "$TMP/t"; mkdir -p "$TMP/t"; cp -r "$ROOT/works" "$ROOT/tools" "$TMP/t/"; }

copy
python3 - "$TMP/t" <<'PY'
import sys
p=sys.argv[1]+'/works/liancheng/chapters/EP015.md'
t=open(p,encoding='utf-8').read().replace('連城猛地睜眼，胸口起伏，眼神卻沒有立刻聚焦。','連城睜眼了。',1)
open(p,'w',encoding='utf-8').write(t)
PY
expect 1 "failure: anchor missing from chapter" python3 "$GUARD" --root "$TMP/t" --ep 15

copy
python3 -c "from PIL import Image; Image.new('RGB',(800,450)).save('$TMP/t/works/liancheng/img/pic/EP015_草包_20261025.jpg')"
expect 1 "failure: image wrong size" python3 "$GUARD" --root "$TMP/t" --ep 15

copy
rm -f "$TMP/t/works/liancheng/img/pic/EP015_睜眼_20261025.jpg"
expect 1 "failure: image missing" python3 "$GUARD" --root "$TMP/t" --ep 15

copy
echo '{broken' > "$TMP/t/works/liancheng/episodes.json"
expect 1 "failure: episodes.json broken" python3 "$GUARD" --root "$TMP/t" --ep 15

rm -rf "$TMP"
if [ "$fails" -eq 0 ]; then echo "ALL PASS"; exit 0; else echo "$fails FAILED"; exit 1; fi
