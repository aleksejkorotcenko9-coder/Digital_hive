#!/bin/bash
# Чистка тестовых напоминаний + прод-сборка.
cd /home/z/my-project

setsid nohup bun run dev > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done

curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"name":"pasichnik","password":"uley2026"}' -c /tmp/cc.txt > /dev/null
IDS=$(curl -s -b /tmp/cc.txt http://localhost:3000/api/reminders | python3 -c "
import json, sys
d = json.load(sys.stdin)
keep = ('Обойти пасеку', 'Заготовить сахарный сироп', 'Проверить летки')
out = []
for r in d['reminders']:
    if not r['text'].startswith(keep):
        out.append(r['id'])
print(' '.join(out))
")
for id in $IDS; do
  curl -s -b /tmp/cc.txt -X DELETE "http://localhost:3000/api/reminders/$id" > /dev/null
done
echo "удалено тестовых напоминаний: $(echo $IDS | wc -w)"
curl -s -b /tmp/cc.txt http://localhost:3000/api/reminders | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('осталось:', len(d['reminders']))
for r in d['reminders']:
    print('-', r['text'][:50], '|', r['remindAt'][:16], '| notified:', r['notifiedAt'] is not None)
"

pkill -f "next dev" 2>/dev/null; pkill -f "bun run dev" 2>/dev/null
sleep 1
echo "=== production build ==="
cd /home/z/my-project && bun run build 2>&1 | tail -12
