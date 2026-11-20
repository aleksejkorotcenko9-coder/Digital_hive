#!/bin/bash
# E2E-тест подтверждения email (замкнутый цикл) на СУЩЕСТВУЮЩЕМ ящике.
# Отправка идёт на digitalhive@mail.ru — ящик отправителя, письмо реально доставляется.
set -u
cd /home/z/my-project

NAME="e2etest$(date +%s)"
PASS="test1234"
TEST_EMAIL="digitalhive@mail.ru"   # существующий ящик — Mail.ru примет адресата

echo "=== 1. Запуск dev-сервера ==="
rm -f /tmp/dev-test.log
( bun run dev > /tmp/dev-test.log 2>&1 ) &
SERVER_PID=$!

for i in $(seq 1 60); do
  if curl -s -o /dev/null --max-time 2 http://localhost:3000/login; then
    echo "Сервер готов (попытка $i)"
    break
  fi
  sleep 1
done
curl -s -o /dev/null --max-time 3 http://localhost:3000/login || { echo "ОШИБКА: сервер не поднялся"; tail -30 /tmp/dev-test.log; exit 1; }

echo ""
echo "=== 2. Регистрация (email: $TEST_EMAIL) ==="
REG=$(curl -s --max-time 40 -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"$NAME\",\"email\":\"$TEST_EMAIL\",\"password\":\"$PASS\",\"role\":\"BEEKEEPER\"}")
echo "register → $REG"
echo "$REG" | grep -q '"warning"' && echo "!!! ПРЕДУПРЕЖДЕНИЕ ОТПРАВКИ ЕСТЬ" || echo "OK: письмо ушло без предупреждений"

echo ""
echo "=== 3. Извлечение кода из лога сервера ==="
CODE=""
for i in $(seq 1 10); do
  CODE=$(grep -oE "письмо с кодом отправлено на $TEST_EMAIL \([^)]*\)\. Код: [0-9]{6}" /tmp/dev-test.log | tail -1 | grep -oE "[0-9]{6}$")
  [ -n "$CODE" ] && break
  sleep 1
done
if [ -n "$CODE" ]; then
  echo "SMTP-отправка подтверждена сервером, код: $CODE"
else
  echo "Код НЕ найден. Ошибки из лога:"
  grep -E "\[email\]|\[register\]|Error|error" /tmp/dev-test.log | tail -8
fi

echo ""
echo "=== 4. Неверный код (ожидаем 400 «Неверный код») ==="
BAD=$(curl -s --max-time 30 -X POST http://localhost:3000/api/auth/verify-code \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEST_EMAIL\",\"code\":\"000000\"}")
echo "wrong-code → $BAD"

echo ""
echo "=== 5. Верный код (ожидаем 200 «Email подтверждён») ==="
if [ -n "$CODE" ]; then
  V=$(curl -s --max-time 30 -X POST http://localhost:3000/api/auth/verify-code \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$TEST_EMAIL\",\"code\":\"$CODE\"}")
  echo "verify-code → $V"
else
  echo "Пропущено: кода нет"
fi

echo ""
echo "=== 6. Вход после подтверждения (ожидаем user + сессию) ==="
L=$(curl -s --max-time 30 -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"$NAME\",\"password\":\"$PASS\"}")
echo "login → $L"

echo ""
echo "=== 7. Email-строки лога ==="
grep -E "\[email\]|\[register\]|\[resend\]" /tmp/dev-test.log | tail -6

echo ""
echo "=== 8. Очистка тестового пользователя ==="
bun -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const u = await db.user.findFirst({ where: { name: '$NAME' } });
if (u) { await db.user.delete({ where: { id: u.id } }); console.log('Удалён:', u.name, u.email); }
else console.log('Тестовый пользователь не найден');
await db.\$disconnect();
" 2>/dev/null || echo "(очистка пропущена)"

kill $SERVER_PID 2>/dev/null
pkill -f "next dev" 2>/dev/null
echo ""
echo "=== ГОТОВО ==="
