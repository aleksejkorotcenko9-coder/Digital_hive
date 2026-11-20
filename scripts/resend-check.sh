#!/bin/bash
# Запуск сервера + повторная отправка кода подтверждения + проверка лога SMTP.
# Всё в одном вызове: процессы между вызовами Bash не выживают.
cd /home/z/my-project

pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1

setsid nohup bun run dev > dev.log 2>&1 &
disown

# Ждём готовности порта до 90 с (predev: prisma db push + compile)
ok=""
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/login 2>/dev/null)
  if [ "$code" = "200" ]; then ok=yes; echo "server ready after ${i}s (login:200)"; break; fi
  sleep 1
done
if [ "$ok" != "yes" ]; then echo "SERVER FAILED TO START"; tail -20 dev.log; exit 1; fi

echo "---- resend ----"
curl -s --max-time 60 -X POST http://localhost:3000/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email":"lenoks0510@yandex.ru"}'
echo
sleep 3
echo "---- log [email] ----"
grep -E "\[email\]|\[register\]" dev.log | tail -6
echo "---- log tail ----"
tail -4 dev.log
