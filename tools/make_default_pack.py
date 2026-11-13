#!/usr/bin/env python3
"""기본 팩(임시 캐릭터 '루미' · 배경)의 그림을 SVG 로 만든다.

넥슨 IP 가 전혀 없는 자체 제작 그림이다. 나중에 작가 커미션 그림이 들어오면 팩만 갈아 끼우면 된다.
    python3 tools/make_default_pack.py
모든 레이어는 같은 캔버스(600×900) · 같은 위치 — StillRig 레이어 규칙 (docs/PACKS.md).
"""
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'app', 'packs', 'default')
CH = os.path.join(ROOT, 'chara', 'lumi', 'poses', 'stand')
W, H = 600, 900
SKIN, SKIN_SH = '#ffeadf', '#f6d3c6'
HAIR, HAIR_HI = '#3d5a8a', '#5b7fb8'
INK = '#26324a'
EYE_L, EYE_R, EYE_Y = 248, 352, 352
MOUTH = (300, 425)


def svg(body, w=W, h=H):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>\n'


def save(path, body, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(svg(body, **kw))


# ───────── 몸통 (머리 · 머리카락 · 옷 · 헤일로) ─────────
BODY = f'''
<defs>
  <linearGradient id="robe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f9ff"/><stop offset="1" stop-color="#d6e6fb"/></linearGradient>
  <linearGradient id="scarf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5ab0ff"/><stop offset="1" stop-color="#3b8be0"/></linearGradient>
  <radialGradient id="cheek" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb4b4" stop-opacity=".55"/><stop offset="1" stop-color="#ffb4b4" stop-opacity="0"/></radialGradient>
</defs>
<!-- 헤일로 -->
<ellipse cx="300" cy="120" rx="118" ry="30" fill="none" stroke="#8fd3ff" stroke-width="11" opacity=".95"/>
<ellipse cx="300" cy="120" rx="118" ry="30" fill="none" stroke="#ffffff" stroke-width="3" opacity=".8"/>
<!-- 뒷머리 -->
<path d="M110 360 C100 220 190 150 300 150 C410 150 500 220 490 360 C488 470 470 560 430 600 L170 600 C130 560 112 470 110 360 Z" fill="{HAIR}"/>
<!-- 옷 (몸통) -->
<path d="M175 560 C150 600 120 700 105 900 L495 900 C480 700 450 600 425 560 C390 530 210 530 175 560 Z" fill="url(#robe)" stroke="#b9cde8" stroke-width="3"/>
<path d="M300 560 L300 900" stroke="#c9dbf1" stroke-width="3"/>
<!-- 팔 -->
<path d="M168 590 C130 650 118 740 140 800 C155 830 190 820 192 790 C196 730 200 660 210 610 Z" fill="#e6f0fc" stroke="#b9cde8" stroke-width="3"/>
<path d="M432 590 C470 650 482 740 460 800 C445 830 410 820 408 790 C404 730 400 660 390 610 Z" fill="#e6f0fc" stroke="#b9cde8" stroke-width="3"/>
<circle cx="165" cy="800" r="24" fill="{SKIN}"/><circle cx="435" cy="800" r="24" fill="{SKIN}"/>
<!-- 목 · 스카프 -->
<rect x="270" y="480" width="60" height="70" rx="18" fill="{SKIN_SH}"/>
<path d="M200 545 C240 590 360 590 400 545 C405 560 400 585 380 598 C330 625 270 625 220 598 C200 585 195 560 200 545 Z" fill="url(#scarf)"/>
<path d="M330 590 L360 690 L330 680 L318 700 Z" fill="#3b8be0"/>
<!-- 얼굴 -->
<ellipse cx="300" cy="350" rx="165" ry="158" fill="{SKIN}"/>
<ellipse cx="215" cy="400" rx="34" ry="20" fill="url(#cheek)"/><ellipse cx="385" cy="400" rx="34" ry="20" fill="url(#cheek)"/>
<!-- 앞머리 -->
<path d="M132 330 C130 230 210 170 300 170 C390 170 470 230 468 330 C440 300 420 260 410 235 C395 280 360 300 330 285 C320 270 312 250 305 232 C292 262 262 292 225 290 C205 289 196 270 192 252 C178 285 158 315 132 330 Z" fill="{HAIR}"/>
<path d="M190 215 C230 185 280 178 320 182" stroke="{HAIR_HI}" stroke-width="10" fill="none" stroke-linecap="round" opacity=".8"/>
<!-- 옆머리 -->
<path d="M135 330 C120 400 128 470 150 520 C165 480 168 420 170 360 Z" fill="{HAIR}"/>
<path d="M465 330 C480 400 472 470 450 520 C435 480 432 420 430 360 Z" fill="{HAIR}"/>
<!-- 머리핀 -->
<path d="M418 248 l14 -14 l14 14 l-14 14 z" fill="#8fd3ff" stroke="#ffffff" stroke-width="3"/>
'''

def eye(cx, cy, rx=17, ry=25):
    return (f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{INK}"/>'
            f'<ellipse cx="{cx}" cy="{cy + ry * 0.35}" rx="{rx * 0.7}" ry="{ry * 0.45}" fill="#4f7fc4" opacity=".75"/>'
            f'<circle cx="{cx - rx * 0.35}" cy="{cy - ry * 0.4}" r="{rx * 0.38}" fill="#fff"/>')


def arc(d, w=7, c=INK):
    return f'<path d="{d}" stroke="{c}" stroke-width="{w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'


mx, my = MOUTH
FACES = {
    'normal': eye(EYE_L, EYE_Y) + eye(EYE_R, EYE_Y) + arc(f'M{mx-16} {my-2} Q{mx} {my+12} {mx+16} {my-2}', 6),
    'smile': arc(f'M{EYE_L-20} {EYE_Y+6} Q{EYE_L} {EYE_Y-22} {EYE_L+20} {EYE_Y+6}', 8) + arc(f'M{EYE_R-20} {EYE_Y+6} Q{EYE_R} {EYE_Y-22} {EYE_R+20} {EYE_Y+6}', 8)
             + f'<path d="M{mx-24} {my-8} Q{mx} {my+30} {mx+24} {my-8} Z" fill="#c4505a"/><path d="M{mx-12} {my+8} Q{mx} {my+18} {mx+12} {my+8} Z" fill="#ff8f8f"/>',
    'surprised': eye(EYE_L, EYE_Y, 20, 29) + eye(EYE_R, EYE_Y, 20, 29) + f'<ellipse cx="{mx}" cy="{my+4}" rx="11" ry="14" fill="#c4505a"/>'
                 + arc(f'M{EYE_L-22} {EYE_Y-48} Q{EYE_L} {EYE_Y-60} {EYE_L+22} {EYE_Y-50}', 6) + arc(f'M{EYE_R-22} {EYE_Y-50} Q{EYE_R} {EYE_Y-60} {EYE_R+22} {EYE_Y-48}', 6),
    'sad': eye(EYE_L, EYE_Y + 4, 16, 22) + eye(EYE_R, EYE_Y + 4, 16, 22)
           + arc(f'M{EYE_L-24} {EYE_Y-30} L{EYE_L+18} {EYE_Y-42}', 6) + arc(f'M{EYE_R-18} {EYE_Y-42} L{EYE_R+24} {EYE_Y-30}', 6)
           + arc(f'M{mx-16} {my+8} Q{mx} {my-6} {mx+16} {my+8}', 6),
    'angry': eye(EYE_L, EYE_Y + 4, 16, 21) + eye(EYE_R, EYE_Y + 4, 16, 21)
             + arc(f'M{EYE_L-24} {EYE_Y-40} L{EYE_L+20} {EYE_Y-26}', 8) + arc(f'M{EYE_R-20} {EYE_Y-26} L{EYE_R+24} {EYE_Y-40}', 8)
             + arc(f'M{mx-18} {my+6} L{mx-6} {my} L{mx+6} {my+6} L{mx+18} {my}', 6),
    'shy': arc(f'M{EYE_L-18} {EYE_Y-14} L{EYE_L+16} {EYE_Y} L{EYE_L-18} {EYE_Y+14}', 7) + arc(f'M{EYE_R+18} {EYE_Y-14} L{EYE_R-16} {EYE_Y} L{EYE_R+18} {EYE_Y+14}', 7)
           + '<ellipse cx="215" cy="398" rx="42" ry="22" fill="#ff9c9c" opacity=".55"/><ellipse cx="385" cy="398" rx="42" ry="22" fill="#ff9c9c" opacity=".55"/>'
           + arc(f'M{mx-20} {my+2} Q{mx-10} {my-8} {mx} {my+2} Q{mx+10} {my+12} {mx+20} {my+2}', 5),
    'sleep': arc(f'M{EYE_L-20} {EYE_Y} Q{EYE_L} {EYE_Y+16} {EYE_L+20} {EYE_Y}', 7) + arc(f'M{EYE_R-20} {EYE_Y} Q{EYE_R} {EYE_Y+16} {EYE_R+20} {EYE_Y}', 7)
             + f'<ellipse cx="{mx}" cy="{my+4}" rx="8" ry="6" fill="#c4505a"/>',
    'think': eye(EYE_L, EYE_Y) + arc(f'M{EYE_R-20} {EYE_Y+2} L{EYE_R+20} {EYE_Y+2}', 7)
             + arc(f'M{EYE_R-22} {EYE_Y-44} L{EYE_R+22} {EYE_Y-36}', 6) + arc(f'M{mx-4} {my+4} L{mx+18} {my-2}', 6),
}
# 눈 감기 (기본 표정 위에 덮는다): 눈 자리를 피부색으로 덮고 감은 눈 선
BLINK = (f'<ellipse cx="{EYE_L}" cy="{EYE_Y}" rx="24" ry="31" fill="{SKIN}"/><ellipse cx="{EYE_R}" cy="{EYE_Y}" rx="24" ry="31" fill="{SKIN}"/>'
         + arc(f'M{EYE_L-20} {EYE_Y+4} Q{EYE_L} {EYE_Y+14} {EYE_L+20} {EYE_Y+4}', 7) + arc(f'M{EYE_R-20} {EYE_Y+4} Q{EYE_R} {EYE_Y+14} {EYE_R+20} {EYE_Y+4}', 7))
# 입 벌림 (어느 표정 위에나): 입 자리를 피부색으로 덮고 벌린 입
MOUTH_OPEN = (f'<ellipse cx="{mx}" cy="{my+4}" rx="32" ry="22" fill="{SKIN}"/>'
              f'<path d="M{mx-16} {my-4} Q{mx} {my-8} {mx+16} {my-4} Q{mx+14} {my+20} {mx} {my+20} Q{mx-14} {my+20} {mx-16} {my-4} Z" fill="#b8424e"/>'
              f'<ellipse cx="{mx}" cy="{my+13}" rx="9" ry="5" fill="#ff8f8f"/>')


def background(night=False):
    if night:
        sky = '<stop offset="0" stop-color="#1b2445"/><stop offset=".6" stop-color="#34407a"/><stop offset="1" stop-color="#5a5f9e"/>'
        glow, tile, line = '#8fa8ff', '#2a3463', '#46529a'
    else:
        sky = '<stop offset="0" stop-color="#bfe6ff"/><stop offset=".6" stop-color="#e3f4ff"/><stop offset="1" stop-color="#f7fbff"/>'
        glow, tile, line = '#ffffff', '#d5ebfb', '#b3d6f2'
    stars = ''.join(f'<circle cx="{(i * 397) % 1920}" cy="{(i * 211) % 520}" r="{1 + i % 3}" fill="#fff" opacity="{0.3 + (i % 5) / 10}"/>' for i in range(60)) if night else ''
    grid = ''.join(f'<path d="M{x} 760 L{960 + (x - 960) * 3} 1080" stroke="{line}" stroke-width="2" opacity=".6"/>' for x in range(0, 1921, 160))
    grid += ''.join(f'<path d="M0 {y} H1920" stroke="{line}" stroke-width="2" opacity=".5"/>' for y in (800, 860, 940, 1040))
    return f'''<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">{sky}</linearGradient>
<radialGradient id="g" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="{glow}" stop-opacity=".6"/><stop offset="1" stop-color="{glow}" stop-opacity="0"/></radialGradient></defs>
<rect width="1920" height="1080" fill="url(#s)"/>{stars}
<ellipse cx="960" cy="560" rx="900" ry="420" fill="url(#g)"/>
<circle cx="380" cy="300" r="140" fill="{glow}" opacity=".18"/><circle cx="1560" cy="220" r="90" fill="{glow}" opacity=".15"/>
<rect y="760" width="1920" height="320" fill="{tile}"/>{grid}'''


def main():
    save(os.path.join(CH, 'body.svg'), BODY)
    for k, v in FACES.items():
        save(os.path.join(CH, 'face', f'{k}.svg'), v)
    save(os.path.join(CH, 'blink.svg'), BLINK)
    save(os.path.join(CH, 'mouth.svg'), MOUTH_OPEN)
    # 프로필 아이콘 (얼굴만 잘라 보이는 정사각형)
    save(os.path.join(ROOT, 'chara', 'lumi', 'icon.svg'),
         f'<svg x="-120" y="-150" width="600" height="900" viewBox="0 0 600 900">{BODY}{FACES["normal"]}</svg>', w=360, h=360)
    save(os.path.join(ROOT, 'bg', 'room_day.svg'), background(False), w=1920, h=1080)
    save(os.path.join(ROOT, 'bg', 'room_night.svg'), background(True), w=1920, h=1080)
    print('ok')


if __name__ == '__main__':
    main()
