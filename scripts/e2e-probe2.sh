#!/bin/bash
# Проба 2: поднимаемся по DOM от элемента-артефакта.
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
  let el = document.elementFromPoint(582, 608);
  const chain = [];
  for (let i = 0; i < 6 && el; i++) {
    const txt = (el.textContent || '').slice(0, 40).trim();
    chain.push(el.tagName + '.' + String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 90) + ' => «' + txt + '»');
    el = el.parentElement;
  }
  return chain.join('\n');
})()
" 2>&1 | tail -10
