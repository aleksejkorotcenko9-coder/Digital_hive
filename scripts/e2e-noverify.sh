#!/bin/bash
# E2E: проверка отключённого подтверждения почты на живом сервере.
# 1) Регистрация нового пользователя → должен вернуть user + cookie, БЕЗ письма
# 2) /api/auth/me с cookie → сессия работает
# 3) Вход tifox2009ivan (неподтверждённый ранее аккаунт) → должен впустить
cd /home/z/my-project

SIZE_BEFORE=$(stat -c %s dev.log 2>/dev/null || echo 0)

echo "=== 1) Регистрация нового пользователя ==="
curl -s -m 60 -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -c /tmp/e2e-cookies.txt \
  -d '{"name":"Тест Входа","email":"no-verify-test@mail.ru","password":"test1234","role":"BEEKEEPER"}' \
  | head -c 600
echo ""

echo ""
echo "=== 2) /api/auth/me с cookie сессии ==="
curl -s -m 30 http://localhost:3000/api/auth/me -b /tmp/e2e-cookies.txt | head -c 400
echo ""

echo ""
echo "=== 3) Вход ранее неподтверждённого аккаунта tifox (Иван Тифокс) ==="
curl -s -m 60 -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"name":"Иван Тифокс","password":"hive2026"}' \
  | head -c 600
echo ""

echo ""
echo "=== Новые строки лога (не должно быть [email]) ==="
tail -c +$((SIZE_BEFORE + 1)) dev.log 2>/dev/null | grep -a "email\|register\|login" | tail -10
echo "(пусто = писем не отправляли, всё быстро и без SMTP)"
