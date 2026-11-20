#!/usr/bin/env python3
"""Parity + reference check for demo i18n (TASK T6-b2).

1. Parses all 6 dicts in src/lib/i18n-extra-demo.ts, compares key sets.
2. Extracts {var} placeholders and verifies they match across languages.
3. Extracts t()/tf() keys referenced in demo components (+ demo-hives loc keys)
   and verifies each resolves in the merged RU dict (base RU + demo RU).
"""
import re
import sys

ROOT = '/home/z/my-project'
EXTRA = ROOT + '/src/lib/i18n-extra-demo.ts'
BASE = ROOT + '/src/lib/i18n.ts'
COMPS = [
    ROOT + '/src/components/bee/DemoDashboard.tsx',
    ROOT + '/src/components/bee/DemoDialogs.tsx',
    ROOT + '/src/components/bee/DemoCharts.tsx',
]
DATA = ROOT + '/src/lib/demo-hives.ts'

LANGS = ['ru', 'en', 'fr', 'kk', 'be', 'zh']

# ---------- parse dicts from i18n-extra-demo.ts ----------
src = open(EXTRA, encoding='utf-8').read()

def parse_dict(text, name):
    m = re.search(r'const %s: Dict = \{' % name, text)
    if not m:
        sys.exit('dict %s not found' % name)
    i = m.end()
    depth = 1
    j = i
    while depth > 0:
        c = text[j]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        j += 1
    body = text[i:j - 1]
    keys = []
    # key: 'xxx' (value may be on same or following lines, single-quoted)
    for km in re.finditer(r"'((?:[^'\\]|\\.)+)'\s*:", body):
        keys.append(km.group(1).replace("\\'", "'"))
    return keys

dicts = {l: parse_dict(src, l.upper()) for l in LANGS}
counts = {l: len(k) for l, k in dicts.items()}
print('== KEY COUNTS ==')
for l in LANGS:
    print(f'  {l}: {counts[l]}')
sets = {l: set(k) for l, k in dicts.items()}
ok = all(sets[l] == sets['ru'] for l in LANGS[1:])
print('== PARITY ==', 'OK — all 6 dicts have identical key sets' if ok else 'MISMATCH')
for l in LANGS[1:]:
    missing = sets['ru'] - sets[l]
    extra = sets[l] - sets['ru']
    if missing:
        print(f'  [{l}] missing {len(missing)}: {sorted(missing)[:8]}{" ..." if len(missing) > 8 else ""}')
    if extra:
        print(f'  [{l}] extra {len(extra)}: {sorted(extra)[:8]}{" ..." if len(extra) > 8 else ""}')

# dupes inside a dict?
for l in LANGS:
    seen, dup = set(), []
    for k in dicts[l]:
        if k in seen:
            dup.append(k)
        seen.add(k)
    if dup:
        print(f'  [{l}] DUPLICATE KEYS: {dup}')

# ---------- {var} placeholder parity ----------
print('== VAR PLACEHOLDER PARITY ==')
# map key -> value per lang: re-scan with values
def parse_pairs(text, name):
    m = re.search(r'const %s: Dict = \{' % name, text)
    i = m.end()
    depth, j = 1, i
    while depth > 0:
        c = text[j]
        depth += 1 if c == '{' else (-1 if c == '}' else 0)
        j += 1
    body = text[i:j - 1]
    # entries: 'key': 'value', possibly spanning lines; values use single quotes escaped \'
    pairs = {}
    for km in re.finditer(r"'((?:[^'\\]|\\.)+)'\s*:\s*(?:\n\s*)?'((?:[^'\\]|\\.)*)'", body):
        key = km.group(1).replace("\\'", "'")
        val = km.group(2).replace("\\'", "'")
        pairs[key] = val
    return pairs

pairs = {l: parse_pairs(src, l.upper()) for l in LANGS}
var_bad = 0
for key in sorted(sets['ru']):
    def vars_of(l):
        v = pairs[l].get(key)
        if v is None:
            return None
        return sorted(set(re.findall(r'\{(\w+)\}', v)))
    base = vars_of('ru')
    for l in LANGS[1:]:
        got = vars_of(l)
        if base is None:
            continue  # value spans quotes-weird; skip (rare)
        if got != base:
            var_bad += 1
            print(f'  VAR MISMATCH {key}: ru={base} {l}={got}')
if var_bad == 0:
    print('  OK — {var} placeholders identical across languages (for parseable values)')

# ---------- base dict keys from i18n.ts (merged fallback) ----------
bsrc = open(BASE, encoding='utf-8').read()
base_keys = set()
for km in re.finditer(r"'([a-z][\w.]*)'\s*:", bsrc):
    base_keys.add(km.group(1))
ru_all = sets['ru'] | base_keys

# ---------- referenced keys in components ----------
print('== REFERENCED KEYS ==')
static = set()
dyn = []
for f in COMPS + [DATA]:
    s = open(f, encoding='utf-8').read()
    for m in re.finditer(r"\b(?:t|tf)\(\s*'([a-z][\w.]*)'", s):
        static.add(m.group(1))
    for m in re.finditer(r'`([a-z][\w.$\{\}]*)`', s):
        if any(m.group(1).startswith(p) for p in ('demo.', 'dash.')):
            dyn.append((f.split('/')[-1], m.group(1)))

unresolved = sorted(k for k in static if k not in ru_all)
print(f'  static keys referenced: {len(static)}; unresolved: {len(unresolved)}')
for k in unresolved:
    print('   UNRESOLVED:', k)
print('  dynamic templates:')
for f, k in dyn:
    print(f'    {f}: {k}')

# ---------- expand dynamic patterns against RU ----------
print('== DYNAMIC KEY RESOLUTION ==')
bad = 0

def need(k, src_key):
    global bad
    if k not in ru_all:
        bad += 1
        print(f'   UNRESOLVED {src_key} -> {k}')

for fid in ['n1', 'n2', 'n3', 'n4', 'f1', 'f2', 'f3', 'f4', 'v1', 'v2', 'v3', 'v4', 's1', 's2', 's3', 's4']:
    for suf in ['title', 'summary', 'urgencyNote', 'probability', 'risk', 'action']:
        need(f'demo.finding.{fid}.{suf}', 'demo.finding.${f.id}.*')

# evidence counts per finding id from demo-hives.ts
dsrc = open(DATA, encoding='utf-8').read()
blocks = re.split(r"\n\s+id: '", dsrc)
ev_counts = {}
for b in blocks[1:]:
    fid = b.split("'")[0]
    ev_counts[fid] = len(re.findall(r"\{ sensor: '", b))
for fid, n in ev_counts.items():
    for i in range(n):
        need(f'demo.evidence.{fid}.{i}', 'demo.evidence.${finding.id}.${i}')

for k in ['weight', 'varroa', 'bloom', 'weather', 'done', 'doneNone']:
    need(f'demo.evening.{k}.title', 'demo.evening.${l.key}.title')
    need(f'demo.evening.{k}.text', 'demo.evening.${l.key}.text')

for s in ['scales', 'mic', 'cam', 'gas', 'temp', 'hum', 'gdd', 'weather', 'stats']:
    need(f'demo.evidence.sensor.{s}', 'demo.evidence.sensor.${sensor}')
for s in ['scales', 'mic', 'cam', 'temp', 'gdd', 'stats', 'weather', 'hum', 'gas']:
    need(f'demo.basis.{s}', 'demo.basis.${BASIS_KEY[b]}')
for c in ['acacia', 'sunflower', 'linden', 'buckwheat']:
    need(f'demo.crop.{c}', 'demo.crop.${c.key}')
    need(f'dash.gdd.note.{c}', 'dash.gdd.note.${c.key}')
for lvl in ['ok', 'risk', 'crit']:
    need(f'dash.varroa.status.{lvl}', 'dash.varroa.status.${level}')
for sc in ['norm', 'flow', 'varroa', 'swarm']:
    need(f'dash.short.{sc}', 'dash.short.${h.scenario}')
    need(f'dash.scen.{sc}', 'dash.scen.${h.scenario}')
    need(f'dash.role.{sc}', 'dash.role.${hive.scenario}')
for h in [0, 1, 2, 3, 4]:
    for fld in ['label', 'scenarioHint', 'entranceLabel', 'acousticLabel', 'corps', 'queenBreed', 'queenMark']:
        if h == 0 and fld in ('queenBreed', 'queenMark'):
            continue  # aggregate hive has queen: null — never rendered
        need(f'demo.hive.{h}.{fld}', 'demo.hive.${hive.id}.*')
for v in ['hot', 'mid', 'ok']:
    need(f'demo.voc.{v}', 'demo.voc.${voc.key}')
for v in ['high', 'active', 'weak', 'low']:
    need(f'demo.traffic.{v}', 'demo.traffic.${traffic.key}')
for t_ in ['alert', 'watch', 'normal', 'ok']:
    need(f'dash.gauge.{t_}', 'dash.gauge.${tone}')

if bad == 0:
    print('   OK — every dynamic key pattern resolves in RU (base + demo dicts)')
print(f'   evidence counts per finding: {ev_counts}')
