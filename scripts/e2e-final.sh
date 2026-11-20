#!/bin/bash
# Финальная проверка: чистый кэш, светлая тема, аватар, тёмная, мобайл.
cd /home/z/my-project
mkdir -p /tmp/render/e2e

pkill -f "next dev" 2>/dev/null; pkill -f "bun run dev" 2>/dev/null
sleep 1
rm -rf .next
setsid nohup bun run dev > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "server is up"

B=agent-browser
$B set viewport 1440 900 2>/dev/null
$B open about:blank 2>/dev/null
$B storage local clear 2>/dev/null   # сброс сохранённой темы прошлых прогонов
$B open http://localhost:3000/ 2>/dev/null | tail -1
$B wait 2000
$B find label "Имя пользователя" fill "pasichnik" 2>/dev/null
$B find label "Пароль" fill "uley2026" 2>/dev/null
$B wait 400
$B find role button click --name "Войти в систему" 2>/dev/null
$B wait 4500

echo "=== 1. светлый дашборд ==="
$B screenshot /tmp/render/e2e/30-light.png 2>&1 | tail -1

echo "=== 2. профиль: меняем имя и аватар ==="
$B find role button click --name "Открыть профиль и настройки" 2>&1 | tail -1
$B wait 900
python3 - <<'EOF'
# генерируем маленький PNG-аватар (красный круг с сотой)
from PIL import Image, ImageDraw
img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.ellipse([8, 8, 248, 248], fill=(233, 58, 45, 255))
d.ellipse([88, 88, 168, 168], fill=(255, 122, 31, 255))
img.save('/tmp/render/e2e/avatar.png')
print('avatar saved')
EOF
$B find role button click --name "Заменить" 2>&1 | tail -1
$B wait 600
# файловый инпут скрыт — используем upload по последнему snapshot
REF=$($B snapshot -i --json 2>/dev/null | python3 -c "
import json,sys
data = json.load(sys.stdin)
def walk(node):
    if isinstance(node, dict):
        if node.get('type') == 'textbox' and 'файл' in str(node.get('name','')).lower():
            return node.get('ref')
        for k, v in node.items():
            r = walk(v)
            if r: return r
    elif isinstance(node, list):
        for v in node:
            r = walk(v)
            if r: return r
    return None
print(walk(data) or '')
" 2>/dev/null)
echo "file input ref: '$REF'"
if [ -n "$REF" ]; then
  $B upload "@$REF" /tmp/render/e2e/avatar.png 2>&1 | tail -1
  $B wait 2500
  $B screenshot /tmp/render/e2e/31-avatar.png 2>&1 | tail -1
else
  echo "файловый инпут не найден в снапшоте — проверим аватар через API"
  curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"name":"pasichnik","password":"uley2026"}' -c /tmp/c2.txt > /dev/null
  AV=$(python3 -c "
from PIL import Image
import base64, io
img = Image.new('RGB', (64, 64), (233, 58, 45))
buf = io.BytesIO(); img.save(buf, 'JPEG', quality=80)
print('data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode())
")
  python3 - <<PYEOF
import json
av = """$AV"""
json.dump({"avatar": av}, open('/tmp/avatar-payload.json', 'w'))
PYEOF
  curl -s -b /tmp/c2.txt -X PATCH http://localhost:3000/api/profile -H "Content-Type: application/json" --data @/tmp/avatar-payload.json | head -c 120
  echo
  $B reload 2>/dev/null
  $B wait 3500
fi

echo "=== 3. меняем имя через диалог ==="
$B find role button click --name "Открыть профиль и настройки" 2>&1 | tail -1
$B wait 800
$B find label "Как вас зовут (видно в интерфейсе)" fill "Иван Петрович" 2>&1 | tail -1
$B find role button click --name "Сохранить" 2>&1 | tail -1
$B wait 1500
$B screenshot /tmp/render/e2e/32-name-saved.png 2>&1 | tail -1
$B press Escape 2>/dev/null
$B wait 600

echo "=== 4. тёмная тема через диалог ==="
$B find role button click --name "Открыть профиль и настройки" 2>&1 | tail -1
$B wait 800
$B find role button click --name "Тёмная" 2>&1 | tail -1
$B wait 1000
$B press Escape 2>/dev/null
$B wait 500
$B screenshot --full /tmp/render/e2e/33-dark-full.png 2>&1 | tail -1

echo "=== 5. светлая обратно + мобайл ==="
$B find role button click --name "Открыть профиль и настройки" 2>&1 | tail -1
$B wait 800
$B find role button click --name "Светлая" 2>&1 | tail -1
$B press Escape 2>/dev/null
$B wait 500
$B set viewport 390 844 2>/dev/null
$B wait 800
$B screenshot --full /tmp/render/e2e/34-mobile-full.png 2>&1 | tail -1
$B eval "document.documentElement.className + ' | ' + (document.querySelector('img[alt=\"Фото профиля\"]') ? 'avatar-img-OK' : 'no-avatar-img')" 2>&1 | tail -2
