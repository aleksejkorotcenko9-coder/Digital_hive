#!/bin/bash
# Где тост? Проверяем bounding rect первого li в toast-viewport.
cd /home/z/my-project
mkdir -p /tmp/render/e2e

curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"name":"pasichnik","password":"uley2026"}' -c /tmp/c7.txt > /dev/null
DATE=$(date -u -d '-1 minute' +%Y-%m-%d)
TIME=$(date -u -d '-1 minute' +%H:%M)
curl -s -b /tmp/c7.txt -X POST http://localhost:3000/api/reminders \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"ГЕО-ТЕСТ тоста\",\"date\":\"$DATE\",\"time\":\"$TIME\"}" > /dev/null

setsid nohup bun run dev > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done

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
$B wait 3000
$B eval "
(() => {
  const vp = document.querySelector('[aria-label=\"Notifications (F8)\"]');
  if (!vp) return 'no viewport';
  const li = vp.querySelector('li');
  if (!li) return 'viewport empty html=' + vp.innerHTML.slice(0, 60);
  const r = li.getBoundingClientRect();
  const cs = getComputedStyle(li);
  return JSON.stringify({ rect: { x: r.x, y: r.y, w: r.width, h: r.height }, state: li.getAttribute('data-state'), opacity: cs.opacity, transform: cs.transform.slice(0, 40), zIndex: cs.zIndex, display: cs.display });
})()
" 2>&1 | tail -3
$B screenshot /tmp/render/e2e/80-toast-geo.png 2>&1 | tail -1
