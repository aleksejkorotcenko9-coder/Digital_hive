#!/bin/bash
# Диагностика: reminders в БД + notifiedAt.
cd /home/z/my-project
setsid nohup bun run dev > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"name":"pasichnik","password":"uley2026"}' -c /tmp/c5.txt > /dev/null
curl -s -b /tmp/c5.txt http://localhost:3000/api/reminders | python3 -c "
import json, sys
from datetime import datetime, timezone
now = datetime.now(timezone.utc)
print('now UTC:', now.isoformat())
d = json.load(sys.stdin)
for r in d['reminders']:
    ra = datetime.fromisoformat(r['remindAt'].replace('Z','+00:00'))
    print('-', r['text'][:45], '| remindAt:', r['remindAt'], '| past:', ra < now, '| done:', r['done'], '| notifiedAt:', r['notifiedAt'])
"
