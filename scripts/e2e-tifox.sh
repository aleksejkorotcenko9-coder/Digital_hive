#!/bin/bash
# E2E: регистрация tifox2009ivan@yandex.ru на живом сервере.
# Проверяем: создаётся ли пользователь с первого раза и уходит ли письмо.
cd /home/z/my-project

EMAIL="tifox2009ivan@yandex.ru"

echo "=== Проверка: есть ли уже пользователь ==="
DATABASE_URL=file:/home/z/my-project/db/custom.db bun -e "
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const u = await p.user.findUnique({ where: { email: '$EMAIL' }, select: { id: true, emailVerified: true, createdAt: true } })
console.log(JSON.stringify(u))
await p.\$disconnect()
"

SIZE_BEFORE=$(stat -c %s dev.log 2>/dev/null || echo 0)
echo ""
echo "=== POST /api/auth/register для $EMAIL ==="
curl -s -m 120 -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Иван Тифокс\",\"email\":\"$EMAIL\",\"password\":\"hive2026\",\"role\":\"BEEKEEPER\"}" \
  | head -c 800
echo ""
echo ""
echo "=== Новые строки лога ([email]/register) ==="
tail -c +$((SIZE_BEFORE + 1)) dev.log 2>/dev/null | grep -a "email\|register" | tail -15
