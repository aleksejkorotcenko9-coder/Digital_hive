#!/bin/bash
# E2E: push-to-talk голосовой ввод в чате ИИ-агента.
# Проверяем: зажали кнопку мыши на микрофоне — пошла запись (кнопка красная,
# появляется «Слушаю…»); отпустили — запись завершилась, появился тост.
cd /home/z/my-project
B=agent-browser
mkdir -p /tmp/render/e2e

$B set viewport 1440 900 2>/dev/null
$B open about:blank 2>/dev/null
$B open http://localhost:3000/ 2>/dev/null | tail -1
$B wait 2500
$B find label "Имя пользователя" fill "pasichnik" 2>/dev/null
$B find label "Пароль" fill "uley2026" 2>/dev/null
$B wait 400
$B find role button click --name "Войти в систему" 2>/dev/null
$B wait 4500
echo "url: $($B get url)"

echo "=== 1. открываем экран ИИ-агента ==="
$B find role button click --name "ИИ-агент" 2>/dev/null
$B wait 2000
$B snapshot -i 2>/dev/null | grep -iE "микроф|Голосовой" | head -3
REF=$($B snapshot -i --json 2>/dev/null | python3 -c "
import json,sys
data = json.load(sys.stdin)
refs = (data.get('data') or {}).get('refs') or data.get('refs') or {}
for ref, node in refs.items():
    if node.get('role') == 'button' and 'Голосовой ввод' in str(node.get('name','')):
        print(ref)
        break
")
echo "mic button ref: '$REF'"
if [ -z "$REF" ]; then
  echo "FAIL: кнопка микрофона не найдена"; exit 1
fi

BOX=$($B get box "@$REF" --json 2>/dev/null)
X=$(echo "$BOX" | python3 -c "import json,sys; d=json.load(sys.stdin).get('data',{}); print(int(d.get('x',0)+d.get('width',0)/2))" 2>/dev/null)
Y=$(echo "$BOX" | python3 -c "import json,sys; d=json.load(sys.stdin).get('data',{}); print(int(d.get('y',0)+d.get('height',0)/2))" 2>/dev/null)
echo "mic button center: ${X}x${Y}"

echo "=== 2. быстрый тап (<600 мс) — ждём подсказку «Короткое нажатие» ==="
$B mouse move $X $Y 2>/dev/null
$B mouse down left 2>/dev/null
$B mouse up left 2>/dev/null
$B wait 900
$B eval "document.body.innerText.includes('Короткое нажатие') || document.body.innerText.includes('Не получилось') || document.body.innerText.includes('Микрофон') ? 'TAP-HINT-SHOWN' : 'no-hint: ' + document.body.innerText.slice(-260).replace(/\n/g,' | ')" 2>&1 | tail -2

echo "=== 3. зажимаем кнопку на 1.6 с — во время удержания должна быть запись ==="
$B mouse move $X $Y 2>/dev/null
$B mouse down left 2>/dev/null
$B wait 1600
$B eval "JSON.stringify({recording: !!document.querySelector('button[aria-label^=\"Отпустите\"]'), listening: document.body.innerText.includes('Слушаю'), micToast: document.body.innerText.includes('Микрофон недоступен')})" 2>&1 | tail -2
$B screenshot /tmp/render/e2e/voice-hold.png 2>&1 | tail -1
$B mouse up left 2>/dev/null
$B wait 1200
echo "=== 4. после отпускания — кнопка снова в покое, появился тост ==="
$B eval "JSON.stringify({recording: !!document.querySelector('button[aria-label^=\"Отпустите\"]'), backToIdle: !!document.querySelector('button[aria-label^=\"Голосовой ввод\"]'), input: (document.querySelector('textarea')||{}).value || ''})" 2>&1 | tail -2
echo "=== 5. ошибки страницы ==="
$B errors 2>&1 | tail -5
