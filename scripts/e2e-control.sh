#!/bin/bash
# Контрольный прогон: светлая тема + режим «Мои данные».
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
$B eval "localStorage.clear(); 'ok'" 2>/dev/null
$B reload 2>/dev/null
$B wait 2000
$B find label "Имя пользователя" fill "pasichnik" 2>/dev/null
$B find label "Пароль" fill "uley2026" 2>/dev/null
$B wait 400
$B find role button click --name "Войти в систему" 2>/dev/null
$B wait 4500
$B screenshot /tmp/render/e2e/90-light-dashboard.png 2>&1 | tail -1

echo "=== переключаем «Мои данные» ==="
$B find role button click --name "Мои данные" 2>&1 | tail -1
$B wait 4000
$B screenshot /tmp/render/e2e/91-real-dashboard.png 2>&1 | tail -1
$B eval "
(() => {
  const t = document.body.innerText;
  return 'реальный режим: ульев в чипах=' + (t.match(/№\d/g) || []).length + ', погода=' + t.includes('Погода на пасеке') + ', состояние=' + t.includes('Состояние пасеки');
})()
" 2>&1 | tail -2
