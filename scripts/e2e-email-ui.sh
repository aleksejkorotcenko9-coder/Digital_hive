#!/bin/bash
# E2E UI: подтверждение email через интерфейс.
# Регистрируем аккаунт с адресом ui-mail-test@example.com — Mail.ru отклонит
# несуществующий ящик (550), поэтому на экране кода появится оранжевое
# предупреждение, а код берём из БД (scripts/peek-verification-code.ts).
# Далее: ввод кода → зелёный экран «Email подтверждён» → вход → приложение.
cd /home/z/my-project
B=agent-browser
mkdir -p /tmp/render/e2e
EMAIL="ui-mail-test@example.com"
PASS="test1234"

# чистим прошлые запуски
bun scripts/peek-verification-code.ts "$EMAIL" --delete >/dev/null 2>&1

$B set viewport 1440 900 2>/dev/null
$B open about:blank 2>/dev/null
$B open http://localhost:3000/ 2>/dev/null | tail -1
$B wait 2500

echo "=== 0. страница /login?verified=true — зелёный баннер ==="
$B open "http://localhost:3000/login?verified=true" 2>/dev/null | tail -1
$B wait 1500
$B eval "document.body.innerText.includes('Email подтверждён. Теперь вы можете войти') ? 'BANNER-OK' : 'BANNER-FAIL: ' + document.body.innerText.slice(0,200)" 2>&1 | tail -1

echo "=== 1. регистрация нового аккаунта ==="
$B open http://localhost:3000/ 2>/dev/null | tail -1
$B wait 2200
$B find role button click --name "Регистрация" 2>/dev/null
$B wait 500
$B find label "Имя пользователя" fill "ui-mail-test" 2>/dev/null
$B find label "Email" fill "$EMAIL" 2>/dev/null
$B find label "Пароль" fill "$PASS" 2>/dev/null
$B wait 400
$B eval "JSON.stringify({emailField: !!document.getElementById('auth-email'), submitDisabled: (document.querySelector('button[type=submit]')||{}).disabled})" 2>&1 | tail -1
$B find role button click --name "Создать аккаунт" 2>/dev/null
$B wait 4000

echo "=== 2. экран «Проверьте почту» + предупреждение SMTP (550) ==="
$B eval "JSON.stringify({codeScreen: document.body.innerText.includes('Проверьте почту'), emailShown: document.body.innerText.includes('$EMAIL'), warning: document.body.innerText.includes('почтовый сервер отклонил этот адрес'), hasInput: !!document.getElementById('auth-code'), resendBlocked: document.body.innerText.includes('Отправить код повторно через')})" 2>&1 | tail -1
$B screenshot /tmp/render/e2e/email-code-screen.png 2>&1 | tail -1

echo "=== 3. ввод кода из БД и подтверждение ==="
CODE=$(bun scripts/peek-verification-code.ts "$EMAIL" 2>/dev/null | tail -1)
echo "code from DB: $CODE"
$B find label "Код из письма" fill "$CODE" 2>/dev/null
$B wait 400
$B find role button click --name "Подтвердить email" 2>/dev/null
$B wait 2500
$B eval "JSON.stringify({greenScreen: document.body.innerText.includes('Email подтверждён'), canLogin: document.body.innerText.includes('Войти в систему')})" 2>&1 | tail -1
$B screenshot /tmp/render/e2e/email-verified.png 2>&1 | tail -1

echo "=== 4. вход после подтверждения ==="
$B find role button click --name "Войти в систему" 2>/dev/null
$B wait 1200
$B eval "JSON.stringify({backToLoginForm: !!document.getElementById('auth-name') && !document.getElementById('auth-code')})" 2>&1 | tail -1
$B find label "Имя пользователя" fill "ui-mail-test" 2>/dev/null
$B find label "Пароль" fill "$PASS" 2>/dev/null
$B wait 300
$B find role button click --name "Войти в систему" 2>/dev/null
$B wait 4500
$B eval "JSON.stringify({appLoaded: document.body.innerText.includes('ИИ-агент'), authGone: !document.body.innerText.includes('Демо-доступ')})" 2>&1 | tail -1
$B screenshot /tmp/render/e2e/email-after-login.png 2>&1 | tail -1

echo "=== 5. ошибки страницы ==="
$B errors 2>&1 | tail -5

# уборка: тестовый аккаунт больше не нужен
bun scripts/peek-verification-code.ts "$EMAIL" --delete >/dev/null 2>&1
echo "cleanup done"
