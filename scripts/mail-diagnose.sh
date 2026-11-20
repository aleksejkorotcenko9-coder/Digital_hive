#!/bin/bash
# Диагностика почты: IMAP ящика отправителя (отчёты о недоставке) +
# контрольное письмо на собственный ящик + свежий код пользователю.
cd /home/z/my-project
set -a; source .env >/dev/null 2>&1; set +a
U="$EMAIL_SERVER_USER"; P="$EMAIL_SERVER_PASSWORD"

echo "=== 1. IMAP: последние письма во входящих ящика отправителя ==="
curl -s --max-time 20 --url "imaps://imap.mail.ru/INBOX?ALL" --user "$U:$P" > /tmp/imap_search.txt
if [ $? -ne 0 ]; then echo "IMAP недоступен"; head -3 /tmp/imap_search.txt; fi
cat /tmp/imap_search.txt | head -2 | tr ' ' '\n' | tail -6 > /tmp/uids.txt
UIDS=$(tail -4 /tmp/uids.txt)
echo "последние UID: $(echo $UIDS | tr '\n' ' ')"
for id in $UIDS; do
  curl -s --max-time 15 --url "imaps://imap.mail.ru/INBOX;UID=$id" --user "$U:$P" 2>/dev/null | \
    grep -iE "^(Subject|From|Date):" | head -3
  echo "---"
done

echo "=== 2. Поиск отчётов о недоставке (DSN) ==="
for pat in "Undelivered" "Failure" "Delayed" "Mail Delivery" "недоставлен"; do
  res=$(curl -s --max-time 15 --url "imaps://imap.mail.ru/INBOX?SUBJECT%20$pat" --user "$U:$P" 2>/dev/null | head -1)
  n=$(echo "$res" | grep -oE "[0-9]+" | grep -vc "^$" || true)
  echo "SUBJECT '$pat': $(echo $res | head -c 120)"
done

echo "=== 3. Контрольное письмо на собственный ящик (проверка доставки) ==="
bun -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: 'smtp.mail.ru', port: 465, secure: true,
  auth: { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD },
  tls: { minVersion: 'TLSv1.2' },
});
t.sendMail({
  from: process.env.EMAIL_FROM, to: process.env.EMAIL_SERVER_USER,
  subject: 'Тест доставки ' + new Date().toISOString().slice(11,19),
  text: 'Контрольное письмо диагностики Цифрового улья',
}).then(i => console.log('SMTP OK:', i.messageId)).catch(e => console.log('SMTP FAIL:', e.message));
" 2>&1 | tail -1

echo "=== 4. Ждём 25 с и проверяем прибытие ==="
sleep 25
res=$(curl -s --max-time 15 --url "imaps://imap.mail.ru/INBOX?SUBJECT%20%22Тест%20доставки%22" --user "$U:$P" 2>/dev/null | head -1)
echo "SEARCH 'Тест доставки': $res"

echo "=== 5. Свежий код пользователю ==="
curl -s --max-time 60 -X POST http://localhost:3000/api/auth/resend-verification \
  -H "Content-Type: application/json" -d '{"email":"lenoks0510@yandex.ru"}'
echo
sleep 2
grep "\[email\]" dev.log | tail -2
