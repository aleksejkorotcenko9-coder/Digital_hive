#!/bin/bash
# Выясняем элемент в точке артефакта (580, 608) на дашборде.
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
$B eval "
(() => {
  const el = document.elementFromPoint(582, 608);
  if (!el) return 'nothing';
  let html = el.outerHTML.slice(0, 300);
  return el.tagName + ' | ' + el.className + ' | ' + html;
})()
" 2>&1 | tail -5
