"""tools/ba_icons.js 가 만든 PNG → app/assets/icons/ba/*.webp + app/data/ba-icons.json  사용: python3 tools/ba_icons_pack.py <PNG 폴더>"""
import json, os, sys
from PIL import Image
src = sys.argv[1]; root = os.path.join(os.path.dirname(__file__), '..', 'app')
meta = json.load(open(os.path.join(src, 'meta.json')))
for x in meta:
    Image.open(os.path.join(src, x['i'] + '.png')).convert('RGBA').save(os.path.join(root, 'assets/icons/ba', x['i'] + '.webp'), 'WEBP', quality=88, method=6)
json.dump(meta, open(os.path.join(root, 'data/ba-icons.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(meta))
