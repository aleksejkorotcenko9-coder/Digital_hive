#!/bin/bash
# Полный E2E цикл подтверждения email по эталону upload/почта.txt:
# 1) регистрация → письмо, БЕЗ сессии
# 2) вход неподтверждённого → 403 needsVerification
# 3) verify-code с неверным кодом → 400
# 4) verify-code с верным кодом → 200
# 5) вход → 200 + cookie
# 6) /api/auth/me → пользователь
# Адрес получателя — собственный ящик digitalhive@mail.ru (существует, Mail.ru примет).
cd /home/z/my-project

SIZE_BEFORE=$(stat -c %s dev.log 2>/dev/null || echo 0)

echo "=== 1) Регистрация verify-cycle@mail.ru ==="
RESP=$(curl -s -m 120 -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -c /tmp/vc-cookies.txt \
  -d '{"name":"Проверка Кода","email":"digitalhive@mail.ru","password":"code1234","role":"BEEKEEPER"}')
echo "$RESP" | head -c 700
echo ""
CODE=$(echo "$RESP" | sed -n 's/.*"demoCode":"\([0-9]\{6\}\)".*/\1/p')
echo "Код из ответа: ${CODE:-НЕ НАЙДЕН}"

echo ""
echo "=== 2) Вход неподтверждённого аккаунта ==="
curl -s -m 30 -w "\nHTTP %{http_code}" -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"name":"Проверка Кода","password":"code1234"}' | head -c 500
echo ""

echo ""
echo "=== 3) verify-code с неверным кодом 000000 ==="
curl -s -m 30 -w "\nHTTP %{http_code}" -X POST http://localhost:3000/api/auth/verify-code \
  -H 'Content-Type: application/json' \
  -d '{"email":"digitalhive@mail.ru","code":"000000"}' | head -c 300
echo ""

echo ""
echo "=== 4) verify-code с верным кодом ==="
curl -s -m 30 -w "\nHTTP %{http_code}" -X POST http://localhost:3000/api/auth/verify-code \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"digitalhive@mail.ru\",\"code\":\"$CODE\"}" | head -c 300
echo ""

echo ""
echo "=== 5) Вход после подтверждения ==="
curl -s -m 30 -w "\nHTTP %{http_code}" -c /tmp/vc-cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"name":"Проверка Кода","password":"code1234"}' | head -c 500
echo ""

echo ""
echo "=== 6) /api/auth/me с сессией ==="
curl -s -m 30 http://localhost:3000/api/auth/me -b /tmp/vc-cookies.txt | head -c 300
echo ""

echo ""
echo "=== Лог отправки ==="
tail -c +$((SIZE_BEFORE + 1)) dev.log 2>/dev/null | grep -a "\[email\]" | tail -5
