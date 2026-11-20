#!/usr/bin/env bash
# E2E: чат-сессии per-user + ИИ (календарь/guide) + камеры на карте.
set -u
BASE="http://localhost:3000"
JAR="/tmp/uley-e2e-cookies.txt"
rm -f "$JAR"

echo "=== 1. Вход Иван Тифокс ==="
LOGIN=$(curl -s -c "$JAR" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"name":"Иван Тифокс","password":"hive2026"}')
echo "$LOGIN" | head -c 300; echo

echo "=== 2. Список чатов (GET /api/chat/sessions) ==="
curl -s -b "$JAR" "$BASE/api/chat/sessions" | head -c 400; echo

echo "=== 3. Создать новый чат (POST /api/chat/sessions) ==="
SESS=$(curl -s -b "$JAR" -X POST "$BASE/api/chat/sessions")
echo "$SESS"; echo
SID=$(echo "$SESS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["session"]["id"])')
echo "SID=$SID"

echo "=== 4. Сохранить обмен в чат (POST /api/chat, sessionId) ==="
curl -s -b "$JAR" -X POST "$BASE/api/chat" -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$SID\",\"userText\":\"Сколько семей на точке?\",\"agentText\":\"Тестовый ответ агента.\"}"; echo

echo "=== 5. Прочитать чат (GET /api/chat?sessionId=...) ==="
curl -s -b "$JAR" "$BASE/api/chat?sessionId=$SID" | head -c 500; echo

echo "=== 6. Переименовать чат (PATCH) ==="
curl -s -b "$JAR" -X PATCH "$BASE/api/chat/sessions/$SID" -H 'Content-Type: application/json' -d '{"title":"Учёт семей"}' | head -c 200; echo

echo "=== 7. Сессии чужого пользователя изолированы: без cookie — 401 ==="
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/chat/sessions/$SID"

echo "=== 8. ИИ: «Календарь цветения медоносов» ==="
CAL=$(curl -s -b "$JAR" -X POST "$BASE/api/agent" -H 'Content-Type: application/json' -d '{"question":"Календарь цветения медоносов"}')
echo "$CAL" | python3 -c 'import sys,json;a=json.load(sys.stdin)["answer"];print("scenario:",a["scenario"]);print("text:",a["text"][:600])'

echo "=== 9. ИИ: «как добавить камеру» ==="
GUIDE=$(curl -s -b "$JAR" -X POST "$BASE/api/agent" -H 'Content-Type: application/json' -d '{"question":"Как добавить камеру в приложении?"}')
echo "$GUIDE" | python3 -c 'import sys,json;a=json.load(sys.stdin)["answer"];print("scenario:",a["scenario"]);print("text:",a["text"][:400])'

echo "=== 10. ИИ: «где посмотреть историю» ==="
GUIDE2=$(curl -s -b "$JAR" -X POST "$BASE/api/agent" -H 'Content-Type: application/json' -d '{"question":"Где посмотреть историю показаний?"}')
echo "$GUIDE2" | python3 -c 'import sys,json;a=json.load(sys.stdin)["answer"];print("scenario:",a["scenario"]);print("text:",a["text"][:300])'

echo "=== 11. ИИ: контроль «Куда везти пасеку к цветению?» — не guide ==="
curl -s -b "$JAR" -X POST "$BASE/api/agent" -H 'Content-Type: application/json' -d '{"question":"Куда везти пасеку к цветению?"}' \
  | python3 -c 'import sys,json;a=json.load(sys.stdin)["answer"];print("scenario:",a["scenario"])'

echo "=== 12. Камера: PATCH cameraUrl на первую точку ==="
PID=$(curl -s -b "$JAR" "$BASE/api/map-points" | python3 -c 'import sys,json;p=json.load(sys.stdin)["points"];print(p[0]["id"] if p else "")')
echo "PID=$PID"
curl -s -b "$JAR" -X PATCH "$BASE/api/map-points/$PID" -H 'Content-Type: application/json' -d '{"cameraUrl":"/cameras/cam-1.jpg"}'; echo
curl -s -b "$JAR" "$BASE/api/map-points" | python3 -c 'import sys,json;p=json.load(sys.stdin)["points"];print("cameraUrl now:",[x.get("cameraUrl") for x in p if x["id"]=="'"$PID"'"])'
echo "--- убрать камеру (null) ---"
curl -s -b "$JAR" -X PATCH "$BASE/api/map-points/$PID" -H 'Content-Type: application/json' -d '{"cameraUrl":null}'; echo

echo "=== 13. Удалить тестовый чат (DELETE) ==="
curl -s -b "$JAR" -X DELETE "$BASE/api/chat/sessions/$SID"; echo
curl -s -b "$JAR" "$BASE/api/chat/sessions" | head -c 300; echo

echo "=== 14. Неверный URL камеры — 400 ==="
curl -s -b "$JAR" -X PATCH "$BASE/api/map-points/$PID" -H 'Content-Type: application/json' -d '{"cameraUrl":"ftp://bad"}' -w " [%{http_code}]"; echo

echo "DONE"
