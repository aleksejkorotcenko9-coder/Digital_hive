#!/bin/bash
# Тест оповещения: напоминание со сроком = сейчас → тост через цикл опроса.
cd /home/z/my-project
mkdir -p /tmp/render/e2e

# создаём напоминание со сроком «2 минуты назад» для pasichnik через API
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"name":"pasichnik","password":"uley2026"}' -c /tmp/c3.txt > /dev/null
DUE=$(python3 -c "
from datetime import datetime, timedelta, timezone
d = datetime.now() - timedelta(minutes=2)
print(d.strftime('%Y-%m-%dT%H:%M:%S'))
")
curl -s -b /tmp/c3.txt -X POST http://localhost:3000/api/reminders \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"СРОЧНО: накрыть улей сеткой\",\"date\":\"$(echo $DUE | cut -d'T' -f1)\",\"time\":\"$(echo $DUE | cut -d'T' -f2)\"}" | head -c 200
echo

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
echo "ждём 55 секунд (цикл опроса напоминаний)..."
$B wait 55000
$B eval "
(() => {
  const body = document.body.innerText;
  const hasToast = body.includes('СРОЧНО: накрыть улей сеткой');
  return 'toast-visible: ' + hasToast;
})()
" 2>&1 | tail -2
$B screenshot /tmp/render/e2e/50-notification.png 2>&1 | tail -1
