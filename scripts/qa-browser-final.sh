#!/usr/bin/env bash
# Финальная QA-проверка в браузере одним вызовом: сервер + вход + профиль +
# выбор города на карте (поиск «Уфа», клик, геокодирование) + пестицидный
# диалог + возврат языка на русский. Скриншоты кладутся в /tmp/render/qa/.
set -u
cd /home/z/my-project
mkdir -p /tmp/render/qa
B=agent-browser

# 1) Сервер (если ещё не поднят)
if ! curl -s -m 4 -o /dev/null http://localhost:3000/; then
  NODE_OPTIONS="--max-old-space-size=1536" nohup bun run dev > /tmp/dev.log 2>&1 &
fi
for i in $(seq 1 12); do
  sleep 5
  code=$(curl -s -m 8 -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  echo "warm$i: $code"
  [ "$code" = "200" ] && break
done

$B set viewport 1600 1000
$B open http://localhost:3000
$B wait 3500

# 2) Вход (если сессия не сохранилась)
if $B eval "document.body.textContent.includes('Войти в систему')" 2>/dev/null | grep -q true; then
  $B find label "Имя пользователя" fill "qa-anim"
  $B find label "Пароль" fill "uley2026"
  $B eval "[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Войти в систему')).click()"
  $B wait 4000
  echo "login done"
fi
$B wait 2000
$B screenshot /tmp/render/qa/01-dashboard.png

# 3) Профиль → выбор города на карте
$B eval "[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Пасечник')&&x.textContent.includes('qa-anim')).click()"
$B wait 1500
$B eval "[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Выбрать на карте')).click()"
$B wait 5000
$B screenshot /tmp/render/qa/02-city-picker.png

# 4) Поиск «Уфа» через поиск Яндекса на карте
$B eval "(()=>{const inp=document.querySelector('.ymaps-2-1-79-searchbox-input__input, [class*=searchbox-input__input]'); if(!inp) return 'no-input'; const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(inp,'Уфа'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'typed'})()"
$B wait 1200
$B eval "(()=>{const inp=document.querySelector('[class*=searchbox-input__input]'); if(!inp) return 'no-input'; inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true})); return 'enter'})()"
$B wait 3500
$B screenshot /tmp/render/qa/03-searched-ufa.png

# 5) Клик по центру карты → геокодер назовёт город
$B eval "(()=>{const m=document.querySelector('[class*=ymaps-2-1][class*=-map]'); if(!m) return 'no-map'; const r=m.getBoundingClientRect(); window.__mapBox=[r.x,r.y,r.width,r.height]; return JSON.stringify(window.__mapBox)})()"
$B eval "(()=>{const [x,y,w,h]=window.__mapBox; return JSON.stringify({cx:x+w/2, cy:y+h/2})})()"
CX=$($B eval "(()=>{const [x,y,w,h]=window.__mapBox; return String(Math.round(x+w/2))})()" | tr -d '"')
CY=$($B eval "(()=>{const [x,y,w,h]=window.__mapBox; return String(Math.round(y+h/2))})()" | tr -d '"')
echo "map center: $CX $CY"
$B mouse move "$CX" "$CY"
$B mouse down left
$B mouse up left
$B wait 3500
$B screenshot /tmp/render/qa/04-picked-ufa.png
$B eval "(()=>{const ps=[...document.querySelectorAll('p')].filter(p=>p.querySelector('svg')===null); return 'name-row: '+(document.body.textContent.match(/Уфа|Приютово|Чуюнчи|Давлекановский|сельсовет/g)||['none']).slice(0,4).join(',')})()"

# 6) Сохранить город
$B eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Сохранить город')); if(!b) return 'no-btn'; if(b.disabled) return 'disabled'; b.click(); return 'saved'})()"
$B wait 2500
$B screenshot /tmp/render/qa/05-city-saved.png

# 7) Закрыть профиль (Escape) и открыть пестицидный диалог
$B press Escape
$B wait 1200
$B eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Что делать?')); if(!b) return 'no-btn'; b.click(); return 'opened'})()"
$B wait 1500
$B screenshot /tmp/render/qa/06-pesticide.png
$B press Escape
$B wait 800

# 8) Проверить шапку: погода по Уфе
$B eval "(()=>{const c=document.querySelector('h1'); const chip=[...document.querySelectorAll('div')].find(d=>d.textContent.includes('Прогноз цветения')&&d.className.includes('rounded-full')); return 'h1='+(c?c.textContent.slice(0,30):'none')+' | chip='+(chip?chip.textContent.replace(/\s+/g,' ').slice(0,120):'none')})()"
$B screenshot /tmp/render/qa/07-final.png

# 9) Язык: вернуть русский (профиль → Русский) — проверить переключение на кириллицу
$B eval "[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Пасечник')&&x.textContent.includes('qa-anim')).click()"
$B wait 1200
$B eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('title')==='Русский'); if(!b) return 'no-btn'; b.click(); return 'ru-set'})()"
$B wait 1500
$B screenshot /tmp/render/qa/08-profile-ru.png
$B press Escape
$B wait 800
$B screenshot /tmp/render/qa/09-dashboard-ru-final.png

echo "QA-FINISHED"
