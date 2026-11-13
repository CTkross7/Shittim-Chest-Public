#!/usr/bin/env python3
"""아로나 모델(인게임 디자인 기준 AI 생성 일러스트)을 리깅용 파트 레이어로 분리한다.

    python3 tools/rig/make_layers.py              # app/assets/img/arona/*.png + layers.json
    python3 tools/rig/make_layers.py --debug X    # 레이어 확인 시트를 X.jpg 로 저장

입력: tools/rig/src/arona_model.png (회색 배경, 머리~허벅지 전신)
처리: 배경 제거 → 허리 아래 잘라냄(화면 아래로 나가는 부분) → 파트 분리 → 가려진 곳 밑칠
레이어 (뒤 → 앞): back(뒷머리+머리 밑칠) · body · face · hair(앞·옆·땋은 머리) · ribbon · halo
리깅 기준점(목 피벗·눈·입 등)은 layers.json 의 "rig" 에 넣어 app/js/arona.js 가 읽는다.

좌표 표기: 아래 숫자는 모두 **배경을 지운 인물 영역(bbox) 기준 0..1** (u=가로, v=세로).
          격자를 그려 잰 값을 그대로 쓰기 위함이다. 잘라낸 레이어 좌표로는 코드가 변환한다.
필요: numpy, Pillow
"""
import colorsys
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(os.path.dirname(__file__), 'src', 'arona_model.png')
OUT = os.path.join(ROOT, 'app/assets/img/arona')
CROP_V = 0.82          # 원본 세로의 이 지점 아래는 버린다 (허리 아래)

# ── 1. 배경 제거 ─────────────────────────────────────────
src = Image.open(SRC).convert('RGB')
a = np.asarray(src).astype(np.int32)
H0, W0, _ = a.shape
bgc = np.median(np.concatenate([a[:6].reshape(-1, 3), a[:, :6].reshape(-1, 3)]), axis=0)
near = np.abs(a - bgc).sum(2) < 30
bg = np.zeros((H0, W0), bool)
q = deque((y, x) for y in (0, H0 - 1) for x in range(W0) if near[y, x])
q.extend((y, x) for x in (0, W0 - 1) for y in range(H0) if near[y, x])
for y, x in q:
    bg[y, x] = True
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H0 and 0 <= nx < W0 and near[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True
            q.append((ny, nx))
# 옷깃·머리카락 사이에 갇힌 배경 덩어리도 지운다 (가장자리에서 닿지 않는 회색 영역)
# 단, 머리카락의 옅은 하이라이트도 회색과 비슷하므로 '완전 무채색'이고 '옷깃 높이'인 것만 대상
neutral = near & (np.abs(a - bgc).sum(2) < 14) & (a.max(2) - a.min(2) < 6)
yy0 = np.arange(H0)[:, None] / H0
neutral &= ((yy0 > 0.36) & (yy0 < 0.46)) | (yy0 < 0.07)                       # 옷깃 사이 · 헤일로 고리 안
seen = bg.copy()
for y0 in range(0, H0, 2):
    for x0 in range(0, W0, 2):
        if neutral[y0, x0] and not seen[y0, x0]:
            blob, q = [(y0, x0)], deque([(y0, x0)])
            seen[y0, x0] = True
            while q:
                y, x = q.popleft()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H0 and 0 <= nx < W0 and neutral[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        blob.append((ny, nx))
                        q.append((ny, nx))
            if len(blob) > 600:
                ys, xs = zip(*blob)
                bg[list(ys), list(xs)] = True
alpha0 = np.asarray(Image.fromarray((~bg * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32)
alpha0 = np.clip((alpha0 - 100) / 120, 0, 1)

# ── 2. 허리 아래 잘라내기 + 좌우 여백 정리 ──────────────────
cols = np.where(alpha0[: int(H0 * CROP_V)].max(0) > 0.05)[0]
X0, X1 = max(0, cols.min() - 8), min(W0, cols.max() + 9)
Y1 = int(H0 * CROP_V)
rgb = a[:Y1, X0:X1].astype(np.float32) / 255
alpha = alpha0[:Y1, X0:X1]
H, W = alpha.shape
A = alpha > 0.04
yy, xx = np.mgrid[0:H, 0:W]
# 측정 기준 = 인물 영역 bbox (원본 전체에서 배경을 뺀 사각형)
_ys, _xs = np.where(alpha0 > 0.05)
BX0, BY0 = _xs.min(), _ys.min()
BW, BH = _xs.max() + 1 - BX0, _ys.max() + 1 - BY0
u = (xx + X0 - BX0) / BW
v = (yy - BY0) / BH


def to_crop(px, py):
    """측정 기준 (u, v) → 잘라낸 레이어 이미지 기준 0..1"""
    return (BX0 + px * BW - X0) / W, (BY0 + py * BH) / H


SX, SY = BW / W, BH / H             # 측정 단위 → 잘라낸 단위 배율


r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
mx, mn = rgb.max(-1), rgb.min(-1)
val, sat = mx, np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
hue = np.vectorize(lambda R, G, B: colorsys.rgb_to_hsv(R, G, B)[0], otypes=[np.float32])(r, g, b) * 360


def ell(cx, cy, rx, ry):
    return ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1


def grow(m, px):
    return np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.MaxFilter(px * 2 + 1))) > 127


def shrink(m, px):
    return np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.MinFilter(px * 2 + 1))) > 127


def blur(arr, radius):
    out, k = arr.astype(np.float32), int(radius)
    for _ in range(3):
        for ax in (0, 1):
            c = np.cumsum(np.pad(out, [(k + 1, k) if i == ax else (0, 0) for i in range(2)], mode='edge'), axis=ax)
            n = out.shape[ax]
            out = (np.take(c, np.arange(2 * k + 1, 2 * k + 1 + n), axis=ax) - np.take(c, np.arange(n), axis=ax)) / (2 * k + 1)
    return out


# ── 3. 색 분류 ───────────────────────────────────────────
skin = A & ((hue < 40) | (hue > 340)) & (sat > 0.04) & (val > 0.60)
white = A & (sat < 0.07) & (val > 0.90)
pale_blue = A & (hue > 165) & (hue < 250) & (sat >= 0.04) & (sat < 0.45) & (val > 0.62)
pink_hair = A & (hue > 290) & (hue <= 340) & (sat > 0.06)
cloth = A & (hue > 170) & (hue < 230) & (sat >= 0.45)                       # 청록 교복
halo_col = A & (hue > 175) & (hue < 215) & (sat > 0.30) & (v < 0.06) & (u > 0.36) & (u < 0.70)

# ── 4. 영역 ──────────────────────────────────────────────
# 실제 턱선 (원본 기준으로 잰 좌표). 이 선 위가 얼굴
jaw = np.interp(u, [0.27, 0.32, 0.40, 0.50, 0.60, 0.66, 0.70], [0.318, 0.338, 0.365, 0.382, 0.372, 0.352, 0.325])
eye = ell(0.370, 0.277, 0.072, 0.036)
mouth = ell(0.495, 0.340, 0.040, 0.012)

halo = grow(halo_col, 3) & A & (v < 0.062)
ribbon = A & (v < 0.128) & ~halo & (white | (val > 0.80) & (sat < 0.12) | (hue > 175) & (hue < 215) & (v < 0.10))
ribbon = shrink(grow(ribbon, 3), 2) & A & (v < 0.130) & ~halo

face_zone = (u > 0.27) & (u < 0.70) & (v > 0.150) & (v < jaw + 0.003)
face = (skin | eye | mouth) & face_zone & A
face = grow(face, 2) & A & face_zone
face |= eye & A

hairc = pale_blue | pink_hair
head_zone = (v < 0.50) & ~halo
hair = A & head_zone & ~face & ~ribbon & (hairc | (val < 0.55) & (v < 0.36))
hair &= ~(((white & ~pale_blue) | cloth) & (v > 0.37))                      # 옷깃·교복은 몸으로
hair &= ~((v > 0.37) & (u > 0.40) & (u < 0.56))                            # 목 앞은 몸
hair = shrink(grow(hair, 3), 2) & A & head_zone & ~face & ~ribbon
hair |= A & (v < 0.36) & ~face & ~ribbon & ~halo                           # 머리 쪽에 남은 픽셀은 머리카락
behind = hair & (v > jaw) & (u > 0.39) & (u < 0.60)                        # 턱 아래로 보이는 머리 = 뒷머리
hair &= ~behind
body = A & ~hair & ~behind & ~face & ~ribbon & ~halo


def fill(known, region, rounds=16, radius=9):
    col = rgb * known[..., None]
    wgt = known.astype(np.float32)
    known = known.copy()
    for _ in range(rounds):
        bc = np.stack([blur(col[..., i], radius) for i in range(3)], -1)
        bw = blur(wgt, radius)
        new = region & ~known & (bw > 0.02)
        if not new.any():
            break
        col[new] = bc[new] / bw[new][..., None]
        wgt[new] = 1
        known |= new
    return col, known


def layer(mask, underlay=None, soft=1.2):
    out = np.zeros((H, W, 4), np.float32)
    if underlay is not None:
        ucol, uk = underlay
        out[..., :3] = ucol
        out[..., 3] = blur(uk.astype(np.float32), 1)
    m = np.clip(blur(mask.astype(np.float32), soft) * 1.6, 0, 1) * (alpha > 0)
    out[..., :3] = out[..., :3] * (1 - m[..., None]) + rgb * m[..., None]
    out[..., 3] = np.maximum(out[..., 3], m * alpha)
    return out


# ── 5. 밑칠 (레이어가 움직여도 구멍이 안 보이게) ─────────────
head_all = A & ell(0.485, 0.245, 0.43, 0.25) & ~halo
back_col = fill(hair | behind, head_all)
face_under = ell(0.475, 0.275, 0.215, 0.135) & (v < jaw + 0.003) & A & (hair | ribbon | face)
face_col = fill(shrink(face & skin & ~eye & ~mouth, 2), face_under, rounds=18)
body_under = A & (face | (hair & (v > 0.33))) & (v > 0.33) & ~behind
body_col = fill(shrink(body, 1), body_under | body, rounds=18)

layers = [
    ('back', layer(hair | behind, back_col)),
    ('body', layer(body, body_col)),
    ('face', layer(face, face_col)),
    ('hair', layer(hair)),
    ('ribbon', layer(ribbon)),
    ('halo', layer(halo, soft=2.0)),
]

# ── 6. 리깅 기준점 (잘라낸 이미지 기준 0..1) ────────────────
c = to_crop
rig = {
    'pivot': c(0.480, 0.388),                    # 목 (머리 회전축)
    'eye': [*c(0.370, 0.277), 0.066 * SX, 0.037 * SY],
    'lid': [c(0, 0.251)[1], c(0, 0.309)[1], 4.2, 6.0],   # 윗속눈썹·아래꺼풀 높이, 곡률(위·아래, 잘라낸 좌표 기준)
    'skinUp': [*c(0.330, 0.241), *c(0.410, 0.241)],      # 눈꺼풀 색을 뜰 위치 (위: 눈두덩)
    'skinDn': [*c(0.330, 0.316), *c(0.420, 0.316)],      #                    (아래: 볼)
    'mouth': [*c(0.495, 0.3405), 0.021 * SX, 0.011 * SY],
    'hair': [c(0.485, 0)[0], c(0, 0.26)[1], c(0, 0.48)[1]],   # 중심 x, 흔들림 시작·끝 높이
    'knot': c(0.520, 0.105),                     # 리본 매듭
    'halo': c(0.520, 0.026),
}

os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith('.png'):
        os.remove(os.path.join(OUT, f))
manifest = {'width': W, 'height': H, 'aspect': W / H, 'rig': rig, 'layers': []}
PAD = 6
for name, arr in layers:
    ys, xs = np.where(arr[..., 3] > 0.01)
    x0, x1 = max(0, xs.min() - PAD), min(W, xs.max() + PAD + 1)
    y0, y1 = max(0, ys.min() - PAD), min(H, ys.max() + PAD + 1)
    Image.fromarray((np.clip(arr[y0:y1, x0:x1], 0, 1) * 255).astype('uint8'), 'RGBA').save(os.path.join(OUT, name + '.png'), optimize=True)
    manifest['layers'].append({'name': name, 'x': x0 / W, 'y': y0 / H, 'w': (x1 - x0) / W, 'h': (y1 - y0) / H})
    print(f'{name:7s} {x1 - x0}x{y1 - y0} @ ({x0},{y0})')
json.dump(manifest, open(os.path.join(OUT, 'layers.json'), 'w'), indent=1)
# 정지 이미지 폴백 (WebGL 미지원 기기)
full = Image.fromarray((np.dstack([rgb, alpha]) * 255).astype('uint8'), 'RGBA')
full.save(os.path.join(ROOT, 'app/assets/img/arona.png'), optimize=True)
print('size', W, H)

if '--debug' in sys.argv:
    path = sys.argv[sys.argv.index('--debug') + 1]
    tiles = []
    for name, arr in layers:
        bgc2 = np.zeros((H, W, 3), np.float32) + np.array([0.25, 0.9, 0.35])
        tiles.append(Image.fromarray(((bgc2 * (1 - arr[..., 3:4]) + arr[..., :3] * arr[..., 3:4]) * 255).astype('uint8')))
    comp = np.ones((H, W, 3), np.float32)
    for _, arr in layers:
        comp = comp * (1 - arr[..., 3:4]) + arr[..., :3] * arr[..., 3:4]
    tiles.append(Image.fromarray((comp * 255).astype('uint8')))
    tw = 300
    tiles = [t.resize((tw, int(H * tw / W))) for t in tiles]
    sheet = Image.new('RGB', (tw * len(tiles), tiles[0].size[1]))
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * tw, 0))
    sheet.save(path, quality=88)
