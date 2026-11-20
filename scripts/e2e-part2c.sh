#!/bin/bash
# E2E часть 2c: вход с ожиданиями между шагами.
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

$B find text "Подставить демо-вход" click 2>/dev/null
$B wait 800
echo "после подстановки:"
$B snapshot -i 2>&1 | grep -E "textbox|Войти в систему"
$B find text "Войти в систему" click 2>/dev/null
$B wait 4000
$B screenshot /tmp/render/e2e/02-dashboard.png 2>&1 | tail -1
echo "=== снапшот после входа ==="
$B snapshot -i 2>&1 | head -50
