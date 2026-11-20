#!/bin/bash
# E2E часть 2: вход → дашборд → погода → профиль/тема → напоминания → мобайл.
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
$B wait 1200

# подставляем демо-вход и входим
$B find text "Войти" click 2>/dev/null | tail -1
$B snapshot -i 2>&1 | head -12
echo "--- заполняем вход ---"
$B fill @e6 "pasichnik" 2>/dev/null
$B fill @e8 "uley2026" 2>/dev/null
$B click @e7 2>/dev/null
$B wait 3000
$B screenshot /tmp/render/e2e/02-dashboard-top.png 2>&1 | tail -1

echo "=== дашборд: снапшот (верх) ==="
$B snapshot -i 2>&1 | head -45
