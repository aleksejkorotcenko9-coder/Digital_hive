#!/bin/bash
# Пересборка архива приложения для скачивания.
cd /home/z/my-project
rm -f download/cifrovoy-uley-app.zip
zip -r download/cifrovoy-uley-app.zip \
  src prisma public db \
  .env package.json bun.lock \
  next.config.ts next-env.d.ts tsconfig.json tailwind.config.ts \
  postcss.config.mjs eslint.config.mjs components.json \
  -x "*.log" > /dev/null
python3 -c "
import zipfile
z = zipfile.ZipFile('download/cifrovoy-uley-app.zip')
files = [n for n in z.namelist() if not n.endswith('/')]
print('файлов в архиве:', len(files))
bee = sorted(n for n in files if n.startswith('src/components/bee/'))
print('bee-компоненты:')
for n in bee: print(' ', n)
"
ls -la download/cifrovoy-uley-app.zip
