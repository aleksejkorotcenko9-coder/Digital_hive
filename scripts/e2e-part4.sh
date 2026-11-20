#!/bin/bash
# E2E часть 4: дашборд (светлый) → напоминания (создание/отметка) → мобайл → тёмный контроль.
cd /home/z/my-project
mkdir -p /tmp/render/e2e

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
$B find label "Имя пользователя" fill "pasichnik" 2>/dev/null
$B find label "Пароль" fill "uley2026" 2>/dev/null
$B wait 400
$B find role button click --name "Войти в систему" 2>/dev/null
$B wait 4500

echo "=== светлый дашборд ==="
$B screenshot /tmp/render/e2e/20-light.png 2>&1 | tail -1
$B screenshot --full /tmp/render/e2e/21-light-full.png 2>&1 | tail -1

echo "=== раздел Напоминания ==="
$B find role button click --name "Напоминания" 2>&1 | tail -1
$B wait 2000
$B screenshot /tmp/render/e2e/22-reminders.png 2>&1 | tail -1
$B snapshot -i 2>&1 | grep -E "textbox|Что напомнить|День|Время|Поставить|Сегодня|Дальше|Просроченные" | head -15

echo "=== создаём напоминание ==="
$B find label "Что напомнить" fill "Позвонить ветеринарному врачу" 2>&1 | tail -1
$B wait 300
# дата уже стоит (сегодня), ставим время
$B find label "Время" fill "15:30" 2>&1 | tail -1
$B wait 300
$B find role button click --name "Поставить" 2>&1 | tail -1
$B wait 2500
$B screenshot /tmp/render/e2e/23-reminder-created.png 2>&1 | tail -1

echo "=== мобайл 390x844 ==="
$B set viewport 390 844 2>/dev/null
$B open http://localhost:3000/ 2>/dev/null | tail -1
$B wait 3000
$B screenshot /tmp/render/e2e/24-mobile.png 2>&1 | tail -1
$B screenshot --full /tmp/render/e2e/25-mobile-full.png 2>&1 | tail -1
