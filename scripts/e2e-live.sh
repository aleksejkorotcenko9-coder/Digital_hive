#!/bin/bash
# E2E-тест на ЖИВОМ платформенном сервере (порт 3000), не убивая его.
# 1) Моментальный снимок позиции dev.log
# 2) POST /api/auth/register на несуществующий mail.ru-адрес (должен вернуть 550-warning)
# 3) Показ новых строк лога с [email] — подтверждение, что ретраи активны на живом сервере
cd /home/z/my-project

SIZE_BEFORE=$(stat -c %s dev.log 2>/dev/null || echo 0)
echo "dev.log size before: $SIZE_BEFORE"

TS=$(date +%s)
EMAIL="smtp-e2e-live-${TS}@mail.ru"
echo "=== POST /api/auth/register для $EMAIL ==="
curl -s -m 90 -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"E2E Live\",\"email\":\"$EMAIL\",\"password\":\"test1234\",\"role\":\"BEEKEEPER\"}" \
  | head -c 1200
echo ""
echo "=== Новые строки dev.log ==="
tail -c +$((SIZE_BEFORE + 1)) dev.log 2>/dev/null | grep -a "email\|register" | tail -20
echo "=== dev.log size after: $(stat -c %s dev.log 2>/dev/null || echo 0) ==="
