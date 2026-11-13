#!/usr/bin/env python3
"""에셋 장부 검사: ASSETS.md 표에 등록되지 않은 그림 · 소리 · 글꼴 파일이 있으면 실패한다.

    python3 tools/check_assets.py

원작 게임에서 추출한 파일이 실수로 섞여 들어가는 것을 막는 안전장치다.
"""
import fnmatch
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
EXT = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ogg', '.mp3', '.wav', '.m4a', '.flac', '.ttf', '.otf', '.woff', '.woff2',
       '.skel', '.atlas', '.moc3', '.psd', '.mp4', '.webm', '.bmp', '.ico'}
SKIP_DIRS = {'.git', 'node_modules', 'build', '.gradle'}
# 이름만 봐도 원작 추출물로 보이는 파일 (장부에 있어도 막는다)
BANNED = re.compile(r'(^|/)(BG_|FX_TEX_|Theme_\d|SE_|UI_Button|Emo_|CH\d{4}|.*_spr\.|arona_|plana_|Arona_Work|Plana_Work)', re.I)


def ledger():
    pats = []
    for line in open(os.path.join(ROOT, 'ASSETS.md'), encoding='utf-8'):
        m = re.match(r'\|\s*`([^`]+)`\s*\|', line)
        if m:
            pats.append(m.group(1))
    return pats


def match(path, pat):
    # ** 는 아무 깊이, * 는 / 를 넘지 않는다
    rx = re.escape(pat).replace(r'\*\*/', '(?:.*/)?').replace(r'\*\*', '.*').replace(r'\*', '[^/]*')
    return re.fullmatch(rx, path) is not None


def main():
    pats = ledger()
    bad, banned = [], []
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            if os.path.splitext(f)[1].lower() not in EXT:
                continue
            rel = os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, '/')
            if BANNED.search(rel):
                banned.append(rel)
            elif not any(match(rel, p) for p in pats):
                bad.append(rel)
    if banned:
        print('원작 추출물로 보이는 파일 (넣을 수 없음):')
        for x in banned:
            print('  ✗', x)
    if bad:
        print('ASSETS.md 에 등록되지 않은 파일:')
        for x in bad:
            print('  ?', x)
    if banned or bad:
        sys.exit(1)
    print(f'에셋 장부 OK ({len(pats)}개 항목)')


if __name__ == '__main__':
    main()
