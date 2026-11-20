#!/bin/bash
# Проверка улья №4 и секции графиков демо-режима.
set -u
cd /home/z/my-project
export PATH="$PATH:/usr/local/bin"

agent-browser set viewport 1440 900 2>/dev/null
agent-browser open http://localhost:3000/ 2>/dev/null
agent-browser wait --load networkidle 2>/dev/null
sleep 2

# Переключение на улей №4 (Роение)
agent-browser eval "
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find(x => /№4/.test(x.textContent || ''));
  if (b) b.click();
  'hive4: ' + (b ? b.textContent.trim().slice(0, 40) : 'none')
" 2>/dev/null
sleep 3
agent-browser screenshot /tmp/viz/03-hive4.png 2>/dev/null

# Прокрутка к графикам
agent-browser eval "
  const el = [...document.querySelectorAll('h3,h2,div')].find(x => /Заклещенность \(Varroa\)|Состояние пасеки/i.test(x.textContent || '') && x.children.length < 5);
  if (el) el.scrollIntoView({ block: 'start' });
  'scrolled'
" 2>/dev/null
sleep 2
agent-browser screenshot /tmp/viz/04-charts-top.png 2>/dev/null

agent-browser eval "window.scrollBy(0, 700)" 2>/dev/null
sleep 2
agent-browser screenshot /tmp/viz/05-charts-mid.png 2>/dev/null

agent-browser eval "window.scrollBy(0, 700)" 2>/dev/null
sleep 2
agent-browser screenshot /tmp/viz/06-charts-bottom.png 2>/dev/null

agent-browser close 2>/dev/null
echo "ГОТОВО"
