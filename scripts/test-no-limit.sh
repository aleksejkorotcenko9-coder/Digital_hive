#!/bin/bash
# Проверка: лимита на ульи нет, правило «1 датчик = 1 улей» работает.
cd /home/z/my-project
echo "=== login ==="
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"name":"pasichnik","password":"uley2026"}' -c /tmp/ck.txt | head -c 120; echo

echo "=== GET /api/map-points (текущее состояние) ==="
curl -s -b /tmp/ck.txt http://localhost:3000/api/map-points | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('points:', len(d['points']), '| catalog:', len(d['catalog']))
for p in d['points']:
    print('-', p['name'], '|', p['sensorCode'], '|', p['lat'], p['lon'], '| active:', p['sensor']['reason'])
field=[c['code'] for c in d['catalog'] if c['zone']=='field']
city=[c['code'] for c in d['catalog'] if c['zone']=='city']
print('field codes:', field)
print('city codes:', city)
"

echo "=== POST #1: городская SN-2518-0147 (лимита нет — должно пройти) ==="
curl -s -b /tmp/ck.txt -X POST http://localhost:3000/api/map-points -H "Content-Type: application/json" \
  -d '{"sensorCode":"SN-2518-0147","name":"Тест: улей 4"}' -o /tmp/p1.json -w "http %{http_code}\n"
python3 -c "import json; d=json.load(open('/tmp/p1.json')); p=d.get('point',{}); print('created:', p.get('id'), '|', p.get('sensorCode'), '|', p.get('lat'), p.get('lon'))"

echo "=== POST #2: городская SN-2518-0366 (вторая подряд — лимита нет) ==="
curl -s -b /tmp/ck.txt -X POST http://localhost:3000/api/map-points -H "Content-Type: application/json" \
  -d '{"sensorCode":"sn 2518 0366","name":"Тест: улей 5"}' -o /tmp/p2.json -w "http %{http_code}\n"
python3 -c "import json; d=json.load(open('/tmp/p2.json')); p=d.get('point',{}); print('created:', p.get('id'), '|', p.get('sensorCode'), '|', p.get('lat'), p.get('lon'))"

echo "=== POST #3: тот же датчик SN-2518-0366 (1 датчик = 1 улей → 400) ==="
curl -s -b /tmp/ck.txt -X POST http://localhost:3000/api/map-points -H "Content-Type: application/json" \
  -d '{"sensorCode":"SN-2518-0366"}' -o /tmp/p3.json -w "http %{http_code}\n"
cat /tmp/p3.json; echo

echo "=== GET: сколько точек стало ==="
curl -s -b /tmp/ck.txt http://localhost:3000/api/map-points | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('points:', len(d['points']))
for p in d['points']: print('-', p['sensorCode'], p['name'])
"
