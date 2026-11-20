#!/bin/bash
# Проба 3: computed styles тёмной темы.
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
$B find label "Имя пользователя" fill "pasichnik" 2>/dev/null
$B find label "Пароль" fill "uley2026" 2>/dev/null
$B wait 400
$B find role button click --name "Войти в систему" 2>/dev/null
$B wait 3500
$B eval "localStorage.setItem('uley-app', JSON.stringify({state:{mode:'demo',theme:'dark'},version:0}))" 2>/dev/null
$B reload 2>/dev/null
$B wait 3000
$B eval "
(() => {
  const h2 = document.querySelector('section h2');
  const h1 = document.querySelector('h1');
  const tileVal = document.querySelector('section .font-bold.text-gray-800');
  const out = [];
  if (h2) out.push('H2 «' + h2.textContent.slice(0,20) + '» class=' + h2.className + ' color=' + getComputedStyle(h2).color);
  if (h1) out.push('H1 «' + h1.textContent.slice(0,20) + '» color=' + getComputedStyle(h1).color);
  if (tileVal) out.push('TILE «' + tileVal.textContent.slice(0,12) + '» color=' + getComputedStyle(tileVal).color);
  // ищем правило .dark .text-gray-800 в стилях
  let found = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText && rule.selectorText.includes('.dark .text-gray-800')) found.push(rule.cssText.slice(0,120));
        if (rule.cssRules) {
          for (const r2 of rule.cssRules) {
            if (r2.selectorText && r2.selectorText.includes('.dark .text-gray-800')) found.push('(nested) ' + r2.cssText.slice(0,120));
          }
        }
      }
    } catch(e) {}
  }
  out.push('RULES: ' + (found.join(' || ') || 'NOT FOUND'));
  return out.join('\n');
})()
" 2>&1 | tail -6
