#!/bin/bash
# E2E: «Мои данные» = своя пасека в Стерлитамаке, синхронизированная с картой;
# погода — реальные данные, без упоминания источников в интерфейсе.
cd /home/z/my-project
B=agent-browser
mkdir -p /tmp/render/e2e

$B set viewport 1440 900 2>/dev/null
$B open about:blank 2>/dev/null
$B open http://localhost:3000/ 2>/dev/null | tail -1
$B wait 2500
$B find label "Имя пользователя" fill "pasichnik" 2>/dev/null
$B find label "Пароль" fill "uley2026" 2>/dev/null
$B wait 400
$B find role button click --name "Войти в систему" 2>/dev/null
$B wait 4500

echo "=== 1. демо-режим: дашборд ==="
$B eval "JSON.stringify({h1: document.querySelector('h1')?.innerText, weatherPlace: document.body.innerText.includes('Чишмы')})" 2>&1 | tail -1

echo "=== 2. переключаемся на «Мои данные» ==="
$B find text "Мои данные" click 2>/dev/null
$B wait 3000
$B eval "JSON.stringify({
  h1: document.querySelector('h1')?.innerText,
  hiveChips: [...document.querySelectorAll('[role=group][aria-label=\"Выбор улья\"] button')].map(b=>b.innerText),
  weatherSterlitamak: document.body.innerText.includes('Стерлитамак'),
  tempTile: document.body.innerText.includes('°C'),
  noOpenMeteo: !document.body.innerText.includes('Open-Meteo')
})" 2>&1 | tail -1
$B screenshot /tmp/render/e2e/real-dashboard.png 2>&1 | tail -1

echo "=== 3. карта в «Моих данных» ==="
$B find role button click --name "Карта пасеки" 2>/dev/null
$B wait 3500
$B eval "JSON.stringify({
  h1: document.querySelector('h1')?.innerText,
  points: [...document.querySelectorAll('ul li p.truncate')].map(p=>p.innerText).slice(0,4),
  codes: ['SN-2518-0901','SN-2518-0902','SN-2518-0903'].map(c=>document.body.innerText.includes(c))
})" 2>&1 | tail -1
$B screenshot /tmp/render/e2e/real-map.png 2>&1 | tail -1

echo "=== 4. датчики в «Моих данных» ==="
$B find role button click --name "Датчики ульев" 2>/dev/null
$B wait 2500
$B eval "JSON.stringify({
  h1: document.querySelector('h1')?.innerText,
  cards: document.querySelectorAll('ul li, .grid > div').length,
  noOpenMeteo: !document.body.innerText.includes('Open-Meteo')
})" 2>&1 | tail -1

echo "=== 5. агент в «Моих данных» ==="
$B find role button click --name "ИИ-агент" 2>/dev/null
$B wait 2500
$B eval "JSON.stringify({
  hives: document.body.innerText.includes('все ульи пасеки (3)'),
  noOpenMeteo: !document.body.innerText.includes('Open-Meteo'),
  sterlitamakHint: document.body.innerText.includes('Стерлитамак')
})" 2>&1 | tail -1
$B screenshot /tmp/render/e2e/real-agent.png 2>&1 | tail -1

echo "=== 6. карта в демо — Чишмы ==="
$B find text "Демо" click 2>/dev/null
$B wait 2000
$B find role button click --name "Карта пасеки" 2>/dev/null
$B wait 3500
$B eval "JSON.stringify({
  h1: document.querySelector('h1')?.innerText,
  chishmyCodes: ['SN-2518-0711','SN-2518-0712','SN-2518-0713'].map(c=>document.body.innerText.includes(c))
})" 2>&1 | tail -1

echo "=== 7. ошибки страницы ==="
$B errors 2>&1 | tail -4
