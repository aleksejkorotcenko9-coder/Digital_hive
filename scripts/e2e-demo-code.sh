#!/bin/bash
# E2E тест нового цикла: регистрация → письмо (с ретраями) → demoCode в ответе → verify-code → очистка.
cd /home/z/my-project

pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1
setsid nohup bun run dev > dev.log 2>&1 &
disown

ok=""
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/login 2>/dev/null)
  if [ "$code" = "200" ]; then ok=yes; echo "server ready after ${i}s"; break; fi
  sleep 1
done
[ "$ok" != "yes" ] && { echo "SERVER FAILED"; tail -20 dev.log; exit 1; }

echo "---- 1. Регистрация нового тестового пользователя ----"
R=$(curl -s --max-time 90 -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Тест E2E","email":"e2e-demo-code@mail.ru","password":"test1234","role":"BEEKEEPER"}')
echo "$R"

CODE=$(echo "$R" | grep -oE '"demoCode":"[0-9]{6}"' | grep -oE '[0-9]{6}')
echo "извлечён demoCode: $CODE"

echo "---- 2. Подтверждение кодом из ответа ----"
curl -s --max-time 30 -X POST http://localhost:3000/api/auth/verify-code \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"e2e-demo-code@mail.ru\",\"code\":\"$CODE\"}"
echo

echo "---- 3. Вход после подтверждения ----"
curl -s --max-time 30 -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"e2e-demo-code@mail.ru","password":"test1234"}' | head -c 200
echo

echo "---- 4. Лог [email] ----"
grep -E "\[email\]" dev.log | tail -4

echo "---- 5. Очистка тестового пользователя ----"
bun -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const u = await p.user.findUnique({ where: { email: 'e2e-demo-code@mail.ru' } });
  if (u) {
    await p.verificationToken.deleteMany({ where: { userId: u.id } });
    await p.user.delete({ where: { id: u.id } });
    console.log('удалён:', u.email, '| verified:', u.emailVerified ? 'yes' : 'no');
  }
  await p.\$disconnect();
})();" 2>&1 | tail -1
