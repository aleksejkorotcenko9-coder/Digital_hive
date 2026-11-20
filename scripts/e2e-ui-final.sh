#!/bin/bash
# Финальный UI-осмотр после удаления демо-режима: логин через форму,
# обход всех экранов, проверка отсутствия «Демо», скриншоты.
cd /home/z/my-project
B=agent-browser
mkdir -p /tmp/render/e2e
PASS="test1234"
EMAIL="digitalhive@mail.ru"

# чистим прошлые запуски и создаём свежий аккаунт с 2 датчиками
bun -e "
import { db } from './src/lib/db';
await db.user.deleteMany({ where: { name: 'ui-final' } });
await db.\$disconnect();
" >/dev/null 2>&1
curl -s -X POST http://localhost:3000/api/auth/register -H 'Content-Type: application/json' \
  -d "{\"name\":\"ui-final\",\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"role\":\"BEEKEEPER\"}" -o /dev/null
CODE=$(bun scripts/peek-verification-code.ts "$EMAIL" 2>/dev/null | tail -1)
curl -s -X POST http://localhost:3000/api/auth/verify-code -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}" -o /dev/null
COOKIE=$(curl -s -i -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"name\":\"ui-final\",\"password\":\"$PASS\"}" | grep -i '^set-cookie' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
curl -s -X POST http://localhost:3000/api/map-points -H 'Content-Type: application/json' -H "Cookie: $COOKIE" \
  -d '{"sensorCode":"SN-2518-0711","name":"Улей №1 (поле)"}' -o /dev/null
curl -s -X POST http://localhost:3000/api/map-points -H 'Content-Type: application/json' -H "Cookie: $COOKIE" \
  -d '{"sensorCode":"SN-2518-0712","name":"Улей №2 (поле)"}' -o /dev/null
echo "подготовка готова (код $CODE, 2 датчика привязаны)"

$B set viewport 1440 900 2>/dev/null
$B open about:blank 2>/dev/null
$B open http://localhost:3000/ 2>/dev/null | tail -1
$B wait 2200

echo "=== 1. форма входа: нет демо-блока ==="
$B eval "JSON.stringify({noDemo: !document.body.innerText.includes('Демо'), noDemoLogin: !document.body.innerText.includes('Подставить демо-вход')})" 2>&1 | tail -1
$B screenshot /tmp/render/e2e/final-login.png 2>&1 | tail -1

echo "=== 2. вход и дашборд ==="
$B find label "Имя пользователя" fill "ui-final" 2>/dev/null
$B find label "Пароль" fill "$PASS" 2>/dev/null
$B find role button click --name "Войти в систему" 2>/dev/null
$B wait 4500
$B eval "JSON.stringify({appLoaded: document.body.innerText.includes('ИИ-агент'), noModeSwitch: !document.body.innerText.includes('Демо'), myApiary: document.body.innerText.includes('Моя пасека'), hives2: document.body.innerText.includes('2 улья') || document.body.innerText.includes('2 улья на карте')})" 2>&1 | tail -1
$B screenshot /tmp/render/e2e/final-dashboard.png 2>&1 | tail -1

echo "=== 3. карта ==="
$B find role button click --name "Карта пасеки" 2>/dev/null
$B wait 5000
$B screenshot /tmp/render/e2e/final-map.png 2>&1 | tail -1

echo "=== 4. датчики ==="
$B find role button click --name "Датчики ульев" 2>/dev/null
$B wait 2500
$B eval "JSON.stringify({sensors: document.body.innerText.includes('Датчики активны') || document.body.innerText.includes('Датчик активен'), noCity: !document.body.innerText.includes('Чишмы')})" 2>&1 | tail -1
$B screenshot /tmp/render/e2e/final-sensors.png 2>&1 | tail -1

echo "=== 5. данные ==="
$B find role button click --name "Данные" 2>/dev/null
$B wait 2500
$B eval "JSON.stringify({noDemoNote: !document.body.innerText.includes('демо-режиме')})" 2>&1 | tail -1
$B screenshot /tmp/render/e2e/final-data.png 2>&1 | tail -1

echo "=== 6. агент ==="
$B find role button click --name "ИИ-агент" 2>/dev/null
$B wait 2500
$B find role button click --name "Как дела на пасеке?" 2>/dev/null
$B wait 6000
$B eval "JSON.stringify({answered: document.body.innerText.includes('ульям пасеки') || document.body.innerText.includes('штатный режим') || document.body.innerText.length > 500})" 2>&1 | tail -1
$B screenshot /tmp/render/e2e/final-agent.png 2>&1 | tail -1

echo "=== 7. кочёвка и справка ==="
$B find role button click --name "Кочёвка" 2>/dev/null
$B wait 2000
$B screenshot /tmp/render/e2e/final-migration.png 2>&1 | tail -1
$B find role button click --name "Справка" 2>/dev/null
$B wait 2000
$B eval "JSON.stringify({noRostelecom: !document.body.innerText.includes('Ростелеком'), appTitle: document.body.innerText.includes('Справка: как работает приложение')})" 2>&1 | tail -1
$B screenshot /tmp/render/e2e/final-about.png 2>&1 | tail -1

echo "=== 8. ошибки страницы ==="
$B errors 2>&1 | tail -4

# уборка: тестовый аккаунт не нужен
bun -e "
import { db } from './src/lib/db';
await db.user.deleteMany({ where: { name: 'ui-final' } });
await db.\$disconnect();
" >/dev/null 2>&1
echo "cleanup done"
