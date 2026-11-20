#!/bin/bash
# Полный перезапуск с чистым кэшем .next + проверка compiled CSS.
cd /home/z/my-project
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
curl -s http://localhost:3000/ > /tmp/page2.html
CSSPATH=$(grep -o 'href="/_next/static/chunks/[^"]*\.css[^"]*"' /tmp/page2.html | head -1 | sed 's/href="//; s/"$//')
echo "css: $CSSPATH"
curl -s "http://localhost:3000$CSSPATH" -o /tmp/app2.css
wc -c /tmp/app2.css
python3 - <<'EOF'
css = open('/tmp/app2.css').read()
import re
print('--background values:', [m.group(0)[:40] for m in re.finditer(r'--background:[^;}]*', css)][:4])
print('.dark .bg-white present:', '.dark .bg-white' in css)
print('.dark .text-gray-800 present:', '.dark .text-gray-800' in css)
print('#171110 count:', css.count('#171110'))
print('#E5D9D0 count:', css.count('#E5D9D0'))
EOF
