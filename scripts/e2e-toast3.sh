#!/bin/bash
# Диагностика тоста: опрашиваем toast-viewport каждую секунду после входа.
cd /home/z/my-project
mkdir -p /tmp/render/e2e

curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"name":"pasichnik","password":"uley2026"}' -c /tmp/c6.txt > /dev/null
# создаём напоминание в прошлом с уникальным текстом
DATE=$(date -u -d '-1 minute' +%Y-%m-%d)
TIME=$(date -u -d '-1 minute' +%H:%M)
curl -s -b /tmp/c6.txt -X POST http://localhost:3000/api/reminders \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"ТОСТ-ТЕСТ $$\",\"date\":\"$DATE\",\"time\":\"$TIME\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('created:', d.get('reminder',{}).get('remindAt'), d.get('error',''))"

setsid nohup bun run dev > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "server is up"

B=agent-browser
$B set viewport 1440 900 2>/dev/null
$B open http://localhost:3000/ 2>/dev/null | tail -1
$B wait 1200
$B eval "localStorage.clear(); 'ok'" 2>/dev/null
$B reload 2>/dev/null
$B wait 1500
$B find label "Имя пользователя" fill "pasichnik" 2>/dev/null
$B find label "Пароль" fill "uley2026" 2>/dev/null
$B find role button click --name "Войти в систему" 2>/dev/null

for t in 1 2 3 4 5 6 7 8; do
  RES=$($B eval "
(() => {
  const vp = document.querySelector('[aria-label=\"Notifications (F8)\"]');
  if (!vp) return 'no-viewport';
  const html = vp.innerHTML;
  if (!html.trim()) return 'empty';
  return 'HAS: ' + html.slice(0, 100).replace(/\"/g, '');
})()
" 2>&1 | tail -1)
  echo "t=${t}s: $RES"
  $B wait 1000 2>/dev/null
done
$B screenshot /tmp/render/e2e/70-toast-hunt.png 2>&1 | tail -1
