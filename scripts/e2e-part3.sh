#!/bin/bash
# E2E часть 3: дашборд (после правок) → профиль → тема → напоминания → мобайл.
cd /home/z/my-project
mkdir -p /tmp/render/e2e

setsid nohup bun run dev > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 90); do
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
$B wait 4000

echo "=== 1. дашборд после правок ==="
$B screenshot /tmp/render/e2e/10-dashboard-fixed.png 2>&1 | tail -1

echo "=== 2. открываем профиль ==="
$B find role button click --name "Открыть профиль и настройки" 2>&1 | tail -1 || $B find role button click --name "pasichnik" 2>&1 | tail -1
$B wait 1000
$B snapshot -i 2>&1 | grep -E "dialog|Тема|Светлая|Тёмная|Системная|Сохранить|Заменить|Выйти|textbox" | head -20
$B screenshot /tmp/render/e2e/11-profile.png 2>&1 | tail -1

echo "=== 3. включаем тёмную тему ==="
$B find role button click --name "Тёмная" 2>&1 | tail -1
$B wait 1200
$B eval "document.documentElement.className" 2>&1 | tail -2
$B screenshot /tmp/render/e2e/12-dark-dashboard.png 2>&1 | tail -1

echo "=== 4. закрываем диалог, тёмный дашборд ==="
$B press Escape 2>/dev/null
$B wait 800
$B screenshot --full /tmp/render/e2e/13-dark-full.png 2>&1 | tail -1
