#!/bin/bash
# E2E на живом сервере: вход tifox2009ivan → вопрос «Календарь цветения медоносов» в /api/agent.
set -u
BASE=http://localhost:3000
LOG=/home/z/my-project/dev.log
EMAIL="Иван Тифокс"
PASS=hive2026

echo "== логин =="
curl -s -c /tmp/cookies.txt -H 'Content-Type: application/json' \
  -d "{\"name\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  "$BASE/api/auth/login" | head -c 300
echo

ask() {
  local q="$1"
  echo "== вопрос: «$q» =="
  curl -s -b /tmp/cookies.txt -H 'Content-Type: application/json' \
    -d "{\"question\":\"$q\",\"hiveId\":null}" \
    "$BASE/api/agent" > /tmp/agent-answer.json
  bun -e '
    const j = await Bun.file("/tmp/agent-answer.json").json();
    const a = j.answer ?? {};
    console.log("engine:", j.engine, "| scenario:", a.scenario, "| urgency:", a.urgency);
    console.log("--- text ---");
    console.log(a.text);
    console.log("--- basis:", (a.basis ?? []).join(" | "));
    console.log("--- metrics:", (a.metrics ?? []).map(m => `${m.label}=${m.value}`).join("; "));
  '
  echo
}

ask "Календарь цветения медоносов"
ask "Когда цветёт липа?"
ask "Куда везти пасеку к цветению?"
ask "Погода и медосбор на неделю?"
