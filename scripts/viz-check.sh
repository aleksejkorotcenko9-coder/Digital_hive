#!/bin/bash
# Вход в дашборд и скриншоты демо-режима (сервер уже запущен отдельным вызовом).
set -u
cd /home/z/my-project

mkdir -p /tmp/viz
export PATH="$PATH:/usr/local/bin"

agent-browser set viewport 1440 900 2>/dev/null
agent-browser open http://localhost:3000/login 2>/dev/null
agent-browser wait --load networkidle 2>/dev/null

NAME="vizcheck1795105642"
agent-browser eval "
  function setNativeValue(el, v) { const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }
  const inputs = document.querySelectorAll('input');
  for (const i of inputs) { if (!i.type || i.type === 'text') setNativeValue(i, '$NAME'); }
  const pw = document.querySelector('input[type=password]');
  setNativeValue(pw, 'viz12345');
  'filled'
" 2>/dev/null
sleep 1
agent-browser eval "
  const b = document.querySelector('button[type=submit]') || [...document.querySelectorAll('button')].find(x => /Войти в систему/i.test(x.textContent || ''));
  if (b) b.click();
  'submit clicked'
" 2>/dev/null
sleep 8
agent-browser wait --load networkidle 2>/dev/null
echo "URL: $(agent-browser get url 2>/dev/null)"
agent-browser screenshot /tmp/viz/01-dashboard.png 2>/dev/null

# Прокрутка вниз для нижних блоков
agent-browser eval "window.scrollTo(0, document.body.scrollHeight)" 2>/dev/null
sleep 2
agent-browser screenshot /tmp/viz/02-dashboard-bottom.png 2>/dev/null

agent-browser close 2>/dev/null
echo "ГОТОВО"
