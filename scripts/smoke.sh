#!/usr/bin/env bash
# End-to-end API smoke test against a running server (local or deployed).
#   BASE=http://localhost:3000 ./scripts/smoke.sh
# Requires the seed data (npm run setup). Exits non-zero on the first failure.
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
FIX="$(cd "$(dirname "$0")/../tests/fixtures" && pwd)"
pass=0

login() { # prints the session cookie for a seeded user id
  curl -s -D - -o /dev/null -X POST "$BASE/api/session" -H 'content-type: application/json' \
    -d "{\"userId\":\"$1\"}" | grep -i '^set-cookie' | sed -E 's/^[Ss]et-[Cc]ookie: ([^;]+).*/\1/'
}
# expect <status> <method> <path> <cookie> [curl args...]
expect() {
  local want=$1 method=$2 path=$3 cookie=$4; shift 4
  local got
  got=$(curl -s -o /tmp/smoke_body -w '%{http_code}' -X "$method" "$BASE$path" -H "cookie: $cookie" "$@")
  if [[ "$got" != "$want" ]]; then
    echo "FAIL: $method $path expected $want got $got: $(cat /tmp/smoke_body)"; exit 1
  fi
  pass=$((pass + 1)); echo "ok   $want $method $path"
}
body() { cat /tmp/smoke_body; }
jget() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log(eval('o.'+process.argv[1]))})" "$1"; }

ALICE=$(login u_alice); BOB=$(login u_bob); CAROL=$(login u_carol)
J=(-H 'content-type: application/json')

# auth
expect 401 GET /api/documents ""
expect 401 GET /api/documents "docdraft_session=u_alice.forged-signature"

# create, rename, save, reopen
expect 201 POST /api/documents "$ALICE" "${J[@]}" -d '{"title":"Smoke doc"}'
DOC=$(body | jget document.id)
expect 200 PATCH "/api/documents/$DOC" "$ALICE" "${J[@]}" -d '{"title":"Smoke doc (renamed)"}'
CONTENT='{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Hi"}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"},{"type":"underline"}],"text":"saved"}]}]}'
expect 200 PATCH "/api/documents/$DOC" "$ALICE" "${J[@]}" -d "{\"content\":$CONTENT,\"version\":1}"
expect 200 GET "/api/documents/$DOC" "$ALICE"
[[ "$(body | jget document.title)" == "Smoke doc (renamed)" ]] || { echo "FAIL: title not persisted"; exit 1; }
[[ "$(body | jget 'document.content.content[1].content[0].marks.length')" == "2" ]] || { echo "FAIL: marks not persisted"; exit 1; }

# validation
expect 400 PATCH "/api/documents/$DOC" "$ALICE" "${J[@]}" -d '{"title":"   "}'
expect 400 PATCH "/api/documents/$DOC" "$ALICE" "${J[@]}" -d '{"content":{"type":"doc","content":[{"type":"script"}]},"version":2}'
expect 400 PATCH "/api/documents/$DOC" "$ALICE" "${J[@]}" -d "{\"content\":$CONTENT}"
expect 400 PATCH "/api/documents/$DOC" "$ALICE" "${J[@]}" -d 'not json'
expect 404 GET /api/documents/not-a-uuid "$ALICE"

# stale version → conflict
expect 409 PATCH "/api/documents/$DOC" "$ALICE" "${J[@]}" -d "{\"content\":$CONTENT,\"version\":1}"

# sharing: strangers see 404, viewers can't edit, editors can, only owner shares/deletes
expect 404 GET "/api/documents/$DOC" "$BOB"
expect 404 PATCH "/api/documents/$DOC" "$BOB" "${J[@]}" -d '{"title":"hijack"}'
expect 201 POST "/api/documents/$DOC/shares" "$ALICE" "${J[@]}" -d '{"email":"BOB@docdraft.test","role":"viewer"}'
expect 404 POST "/api/documents/$DOC/shares" "$ALICE" "${J[@]}" -d '{"email":"nobody@docdraft.test"}'
expect 400 POST "/api/documents/$DOC/shares" "$ALICE" "${J[@]}" -d '{"email":"alice@docdraft.test"}'
expect 400 POST "/api/documents/$DOC/shares" "$ALICE" "${J[@]}" -d '{"email":"not-an-email"}'
expect 200 GET "/api/documents/$DOC" "$BOB"
expect 403 PATCH "/api/documents/$DOC" "$BOB" "${J[@]}" -d '{"title":"viewer edit"}'
expect 200 GET /api/documents "$BOB"
[[ "$(body | jget "shared.some(d=>d.id==='$DOC'&&d.role==='viewer')")" == "true" ]] || { echo "FAIL: not in Bob's shared list"; exit 1; }
expect 201 POST "/api/documents/$DOC/shares" "$ALICE" "${J[@]}" -d '{"email":"bob@docdraft.test","role":"editor"}'
expect 200 PATCH "/api/documents/$DOC" "$BOB" "${J[@]}" -d "{\"content\":$CONTENT,\"version\":2}"
expect 403 POST "/api/documents/$DOC/shares" "$BOB" "${J[@]}" -d '{"email":"carol@docdraft.test"}'
expect 403 DELETE "/api/documents/$DOC" "$BOB"
expect 404 GET "/api/documents/$DOC" "$CAROL"
expect 200 DELETE "/api/documents/$DOC/shares/u_bob" "$ALICE"
expect 404 GET "/api/documents/$DOC" "$BOB"

# uploads
expect 201 POST /api/import "$ALICE" -F "file=@$FIX/notes.txt" -F mode=new
expect 201 POST /api/import "$ALICE" -F "file=@$FIX/roadmap.md" -F mode=new
expect 201 POST /api/import "$ALICE" -F "file=@$FIX/spec.docx" -F mode=new
expect 200 POST /api/import "$ALICE" -F "file=@$FIX/roadmap.md" -F mode=convert
expect 415 POST /api/import "$ALICE" -F "file=@$FIX/fake.docx"
expect 415 POST /api/import "$ALICE" -F "file=@$FIX/binary.txt"
expect 415 POST /api/import "$ALICE" -F "file=@$0"
expect 400 POST /api/import "$ALICE" "${J[@]}" -d '{}'
expect 401 POST /api/import "" -F "file=@$FIX/notes.txt"

# owner deletes
expect 200 DELETE "/api/documents/$DOC" "$ALICE"
expect 404 GET "/api/documents/$DOC" "$ALICE"

echo "All $pass checks passed."
