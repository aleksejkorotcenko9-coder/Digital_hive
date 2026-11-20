#!/bin/bash
# Точный тест тоста: свежее напоминание «в сроке» → скриншот через 3 сек после входа.
cd /home/z/my-project
mkdir -p /tmp/render/e2e

curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"name":"pasichnik","password":"uley2026"}' -c /tmp/c4.txt > /dev/null
DUE=$(python3 -c "
from datetime import datetime, timedelta
d = datetime.now() - timedelta(minutes=1)
print(d.strftime('%Y-%m-%d %H:%M:%S'))
")
DATE=$(echo $DUE | cut -d' ' -f1); TIME=$(echo $DUE | cut -d' ' -f2)
curl -s -b /tmp/c4.txt -X POST http://localhost:3000/api/reminders \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"Проверить температуру в улье №2\",\"date\":\"$DATE\",\"time\":\"$TIME\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('created:', d.get('reminder',{}).get('id', d.get('error')))"

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
$B wait 1500
$B eval "localStorage.clear(); 'ok'" 2>/dev/null
$B reload 2>/dev/null
$B wait 2000
$B find label "Имя пользователя" fill "pasichnik" 2>/dev/null
$B find label "Пароль" fill "uley2026" 2>/dev/null
$B find role button click --name "Войти в систему" 2>/dev/null
$B wait 3500
$B eval "
(() => {
  // ищем тост именно в toast-viewport, а не в тексте страницы
  const vp = document.querySelector('[aria-label=\"Notifications (F8)\"]');
  const toastEl = vp ? vp.querySelector('[data-state=\"open\"], .toast, li') : null;
  return 'toast in viewport: ' + (toastEl ? toastEl.textContent.slice(0, 120) : 'none');
})()
" 2>&1 | tail -2
$B screenshot /tmp/render/e2e/60-toast.png 2>&1 | tail -1
