#!/bin/bash
# Финал 2: светлая тема (чистый origin), тост напоминания, аватар через UI.
cd /home/z/my-project
mkdir -p /tmp/render/e2e

setsid nohup bun run dev > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "server is up"

B=agent-browser
$B set viewport 1440 900 2>/dev/null
$B open http://localhost:3000/ 2>/dev/null | tail -1
$B wait 1500
# чистим localStorage именно на origin приложения
$B eval "localStorage.clear(); 'cleared'" 2>&1 | tail -1
$B reload 2>/dev/null
$B wait 2000
$B find label "Имя пользователя" fill "pasichnik" 2>/dev/null
$B find label "Пароль" fill "uley2026" 2>/dev/null
$B wait 400
$B find role button click --name "Войти в систему" 2>/dev/null
$B wait 6000   # ждём опрос напоминаний — должно прийти оповещение о просроченном
$B screenshot /tmp/render/e2e/40-light-toast.png 2>&1 | tail -1

echo "=== пробуем загрузить аватар через UI ==="
$B find role button click --name "Открыть профиль и настройки" 2>&1 | tail -1
$B wait 800
$B upload "input[type=file]" /tmp/render/e2e/avatar.png 2>&1 | tail -1
$B wait 3000
$B screenshot /tmp/render/e2e/41-avatar-upload.png 2>&1 | tail -1
$B eval "
(() => {
  const img = document.querySelector('img[alt=\"Фото профиля\"]');
  return img ? 'avatar in dialog: OK (' + img.src.slice(0, 30) + '...)' : 'no avatar img in dialog';
})()
" 2>&1 | tail -2
$B press Escape 2>/dev/null
$B wait 500
$B screenshot /tmp/render/e2e/42-light-final.png 2>&1 | tail -1
