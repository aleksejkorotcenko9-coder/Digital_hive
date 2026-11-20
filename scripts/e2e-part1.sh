#!/bin/bash
# E2E-прогон: сервер + agent-browser в одном вызове bash.
# Скриншоты складываются в /tmp/render/e2e/.
cd /home/z/my-project
mkdir -p /tmp/render/e2e

setsid nohup bun run dev > /dev/null 2>&1 < /dev/null &

ok=""
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then ok="yes"; break; fi
  sleep 1
done
[ -z "$ok" ] && { echo "SERVER DID NOT START"; exit 1; }
echo "server is up"

# чистим хвосты прошлых тестов: удаляем тестовое напоминание через API
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"name":"pasichnik","password":"uley2026"}' -c /tmp/cookies.txt > /dev/null
RID=$(curl -s -b /tmp/cookies.txt http://localhost:3000/api/reminders | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d['reminders']:
    if r['text'].startswith('Тест:'):
        print(r['id']); break
" 2>/dev/null)
if [ -n "$RID" ]; then
  curl -s -b /tmp/cookies.txt -X DELETE "http://localhost:3000/api/reminders/$RID" > /dev/null
  echo "старый тестовый reminder удалён: $RID"
fi

B=agent-browser
$B set viewport 1440 900
$B open http://localhost:3000/ 2>&1 | tail -1
$B wait --load networkidle 2>/dev/null
$B wait 1500

echo "=== экран входа ==="
$B screenshot /tmp/render/e2e/01-auth.png 2>&1 | tail -1
$B snapshot -i 2>&1 | head -25
