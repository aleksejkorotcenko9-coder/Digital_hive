#!/bin/bash
# Тестовый прогон: поднимает dev-сервер и проверяет API в пределах одного вызова.
cd /home/z/my-project

setsid nohup bun run dev > /dev/null 2>&1 < /dev/null &

# ждём готовности (до 90 сек)
ok=""
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then ok="yes"; break; fi
  sleep 1
done
if [ -z "$ok" ]; then echo "SERVER DID NOT START"; exit 1; fi
echo "server is up"

echo "=== /api/weather ==="
curl -s --max-time 30 http://localhost:3000/api/weather | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('source:', d['source'], '| place:', d['place'])
print('now:', d['now']['tempC'], 'C,', d['now']['text'], '| wind', d['now']['windKmh'], 'km/h | hum', d['now']['humidityPct'], '% | pres', d['now']['pressureMm'])
print('days:', len(d['days']), '| first:', d['days'][0]['dayLabel'], d['days'][0]['tMax'], '/', d['days'][0]['tMin'], '| icon', d['days'][0]['icon'])
"

echo "=== login ==="
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"name":"pasichnik","password":"uley2026"}' -c /tmp/cookies.txt | head -c 260
echo

echo "=== /api/reminders (после входа) ==="
curl -s -b /tmp/cookies.txt http://localhost:3000/api/reminders | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('count:', len(d['reminders']))
for r in d['reminders'][:5]:
    print('-', r['text'][:50], '|', r['remindAt'][:16], '| done:', r['done'], '| hive:', r['hiveName'])
"

echo "=== создание напоминания ==="
TOMORROW=$(python3 -c "from datetime import date,timedelta;print((date.today()+timedelta(days=1)).isoformat())")
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/reminders \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"Тест: проверить летки\",\"date\":\"$TOMORROW\",\"time\":\"09:30\"}" | head -c 400
echo

echo "=== профиль: обновление имени ==="
curl -s -b /tmp/cookies.txt -X PATCH http://localhost:3000/api/profile \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Иван Иванович"}' | head -c 300
echo

echo "=== профиль: сброс имени ==="
curl -s -b /tmp/cookies.txt -X PATCH http://localhost:3000/api/profile \
  -H "Content-Type: application/json" \
  -d '{"displayName":null}' | head -c 200
echo

echo "=== PATCH напоминания done=true/false ==="
RID=$(curl -s -b /tmp/cookies.txt http://localhost:3000/api/reminders | python3 -c "import json,sys;print(json.load(sys.stdin)['reminders'][0]['id'])")
curl -s -b /tmp/cookies.txt -X PATCH "http://localhost:3000/api/reminders/$RID" \
  -H "Content-Type: application/json" -d '{"done":true}' | head -c 260
echo
curl -s -b /tmp/cookies.txt -X PATCH "http://localhost:3000/api/reminders/$RID" \
  -H "Content-Type: application/json" -d '{"done":false}' > /dev/null
echo "done=false отправлен"

tail -4 dev.log
echo "=== DONE ==="
