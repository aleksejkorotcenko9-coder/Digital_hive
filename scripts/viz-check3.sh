#!/bin/bash
# Полная проверка: вход → улей №4 → графики.
set -u
cd /home/z/my-project
export PATH="$PATH:/usr/local/bin"

agent-browser set viewport 1440 900 2>/dev/null
agent-browser open http://localhost:3000/login 2>/dev/null
agent-browser wait --load networkidle 2>/dev/null

agent-browser eval "
  function setNativeValue(el, v) { const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }
  const inputs = document.querySelectorAll('input');
  for (const i of inputs) { if (!i.type || i.type === 'text') setNativeValue(i, 'vizcheck1795105642'); }
  setNativeValue(document.querySelector('input[type=password]'), 'viz12345');
  'filled'
" 2>/dev/null
sleep 1
agent-browser eval "
  (document.querySelector('button[type=submit]') || [...document.querySelectorAll('button')].find(x => /Войти в систему/i.test(x.textContent || '')))?.click();
  'submitted'
" 2>/dev/null
sleep 8
agent-browser wait --load networkidle 2>/dev/null
echo "URL: $(agent-browser get url 2>/dev/null)"

# Улей №4
agent-browser eval "
  const b = [...document.querySelectorAll('button,div[role=button],span')].find(x => /№4|Роение/.test(x.textContent || '') && (x.textContent || '').length < 60 && x.children.length <= 2);
  if (b) { b.click(); }
  'hive4: ' + (b ? (b.textContent || '').trim().slice(0, 50) : 'none')
" 2>/dev/null
sleep 3
agent-browser screenshot /tmp/viz/03-hive4.png 2>/dev/null

# Графики: прокрутка от блока «Состояние пасеки»
agent-browser eval "window.scrollTo(0, 900)" 2>/dev/null; sleep 1.5
agent-browser screenshot /tmp/viz/04-charts-top.png 2>/dev/null
agent-browser eval "window.scrollTo(0, 1700)" 2>/dev/null; sleep 1.5
agent-browser screenshot /tmp/viz/05-charts-mid.png 2>/dev/null
agent-browser eval "window.scrollTo(0, 2500)" 2>/dev/null; sleep 1.5
agent-browser screenshot /tmp/viz/06-charts-bottom.png 2>/dev/null
agent-browser eval "window.scrollTo(0, 3300)" 2>/dev/null; sleep 1.5
agent-browser screenshot /tmp/viz/07-charts-end.png 2>/dev/null

agent-browser close 2>/dev/null
echo "ГОТОВО"
