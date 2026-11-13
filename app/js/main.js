// [Unofficial] 싯딤의 상자 — 비공식 팬메이드 런처 (개발: CTkross)
// 넥슨 · 블루 아카이브 공식과 관련이 없습니다. 캐릭터 · 대사 · 배경은 캐릭터 팩(app/packs)에서 읽는다.
import { Audio } from './audio.js';
import { CharaRig } from './rig.js';
import { TapFx } from './tapfx.js';
import { createHome } from './home.js';
import { createWork } from './work.js';
import { CHARS, LINES as PACK_LINES, SITU as PACK_SITU, loadPacks, byId, bgsOf, slotOf, modelOf } from './packs.js';
import { createMissions, dayKey } from './missions.js';
import * as NV from './native.js';
const { N, isNative } = NV;

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get: (k, d) => { try { const v = localStorage.getItem('shittim.' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
  set: (k, v) => { try { localStorage.setItem('shittim.' + k, JSON.stringify(v)); } catch (_) { /* 저장 불가 환경 */ } },
};
const CFG = window.SHITTIM;
const state = {
  name: store.get('name', CFG.senseiName),
  vol: store.get('vol', CFG.volume),
  bgm: store.get('bgm', CFG.bgmVolume),
};
const params = new URLSearchParams(location.search);
await loadPacks();
// 앱 목록: 저장된 값이 config.js 기본값보다 우선
const APPS = (() => {
  const saved = store.get('apps', null);
  const pick = (k, n) => {
    const base = (CFG[k] || []).slice(0, n);
    const got = saved && Array.isArray(saved[k]) ? saved[k] : base;
    return Array.from({ length: n }, (_, i) => ({ icon: '', name: '', url: '', ...(got[i] || {}) }));
  };
  return { dock: pick('dock', 8), drawer: pick('drawer', 12) };
})();
const saveApps = () => store.set('apps', APPS);
// APK(런처) 모드: 하단 바는 설치된 앱 8개 {pkg, label}, 전체 앱은 기기의 모든 앱
const NAT = isNative ? {
  dock: store.get('nativeDock', null),
  themed: store.get('themeIcons', false),
} : null;
if (NAT && !NAT.dock) { NAT.dock = NV.defaultDock(); store.set('nativeDock', NAT.dock); }
const saveNat = () => { store.set('nativeDock', NAT.dock); store.set('themeIcons', NAT.themed); };
/** 아이콘: 이모지 또는 이미지 경로 */
const iconHtml = (ic) => (/\.(png|jpe?g|webp|svg)$/i.test(ic || '') ? `<img src="${esc(ic)}" alt="">` : esc(ic || '▫️'));
/** 주소 열기 — intent:// 는 크롬/키오스크 브라우저가 앱으로 넘긴다 */
async function launch(item) {
  if (isNative && item && item.pkg) {
    await splash(300);
    if (!N.launch(item.pkg)) bubble('그 앱을 찾을 수 없어요, 선생님…….');
    splashOut();
    return;
  }
  if (isNative && item && /^(https?|intent):/.test(item.url || '')) { await splash(300); N.openUrl(item.url); splashOut(); return; }
  if (!item || !item.url) return bubble(isNative ? '빈 칸이에요. 설정 → 앱 편집에서 앱을 넣어 주세요!' : LINES.none);
  await splash(400);
  try { location.href = item.url; }
  catch (_) { bubble('그 앱을 열 수 없었어요, 선생님…….'); }
  setTimeout(() => $('#splash').classList.remove('on'), 600);
}
/** 화면 전환: 캐릭터 색으로 부드럽게 덮었다가 걷는다 (원작 로고 연출 대신 자체 전환) */
async function splash(ms = 450, keep = true) {
  const s = $('#splash');
  const next = splash.pre || pickChara();                  // 이번 전환에서 나올 캐릭터 (랜덤) — 전환 색은 그 캐릭터로
  splash.pre = null;
  s.style.setProperty('--sp', byId(next).color);
  s.classList.add('on');
  await wait(Math.min(ms, 380));
  // 전환 화면이 다 덮은 뒤에 바꾼다 — 미리 바뀐 캐릭터가 보이지 않게
  if (next !== CHARA) { setChara(next); rig.expr(F0()); }
  if (!keep) await splashOut();
}
async function splashOut() {
  const s = $('#splash'); if (!s.classList.contains('on')) return;
  s.classList.add('out'); await wait(280); s.classList.remove('on', 'out');
}
const stage = $('#stage');
const audio = new Audio();
audio.vol = state.vol; audio.bgmVol = state.bgm;
// 등장 캐릭터: 팩에 있는 캐릭터 · 랜덤(켤 때마다)
const randomOf = () => CHARS[(Math.random() * CHARS.length) | 0].id;
let CHARA = (() => { const c = store.get('chara', CHARS[0].id); return c.startsWith('random') ? randomOf() : (CHARS.some((x) => x.id === c) ? c : CHARS[0].id); })();
const CH = () => byId(CHARA);
let POSE = CH().pose0;
const F0 = () => CH().face0;   // 기본 표정
document.documentElement.dataset.chara = CHARA;
/** '랜덤'이면 장면이 바뀔 때마다 새로 뽑는다. 전환 전까지는 같은 캐릭터 */
function pickChara() {
  const m = store.get('chara', CHARA);
  if (!m.startsWith('random')) return CHARA;
  return randomOf();
}
function rollChara() { const c = pickChara(); if (c !== CHARA) setChara(c); }
/** 캐릭터 바꾸기: 모델 · 기본 표정 · 몸 움직임(숨쉬기 · 흔들림) · 테마 색 */
function setChara(c) {
  CHARA = c; document.documentElement.dataset.chara = c; POSE = CH().pose0;
  rig.face0 = CH().face0; rig.setModel(modelOf(CH(), POSE));
  applyCharaLook();
  mood.state = 'normal';
  if (typeof studentBg === 'function') studentBg(true);
}
function applyCharaLook() {
  const p = CH(), ar = document.getElementById('arona');
  rig.face0 = p.face0;
  rig.motion = { breath: p.breath, sway: p.sway, bob: p.bob, neck: p.neck, cx: p.cx };   // 몸 움직임 (stillrig.js warp)
  ar.style.setProperty('--breath', p.breath + 's'); ar.style.setProperty('--sway', p.sway + 'deg'); ar.style.setProperty('--bob', String(p.bob / 100));
  ar.classList.add('still');
  document.documentElement.style.setProperty('--chara-color', p.color);
  document.documentElement.style.setProperty('--chara-icon', p.icon ? `url("${new URL(p.icon, location.href).href}")` : 'none');
  rig.expr(p.face0);
}
const rig = new CharaRig($('#arona-canvas'));
rig.face0 = CH().face0; rig.setModel(modelOf(CH(), POSE));
applyCharaLook();
window.__rig = rig; window.__audio = audio;   // 디버그/테스트용
setTimeout(() => { window.__openWork = () => openWorkScr(); }, 0);
new TapFx($('#tapfx'));
// 길게 누르기: 이미지 저장·텍스트 선택 메뉴가 뜨지 않게 (태블릿 OS처럼)
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('dragstart', (e) => e.preventDefault());
addEventListener('selectstart', (e) => { if (!e.target.closest?.('input, textarea')) e.preventDefault(); });
const scene = (n) => { stage.dataset.scene = n; if (n === 'room' || n === 'lobby') rig.resize(); };

// ───────── 렌더 루프 ─────────
// 저전력 모드: 캐릭터를 초당 24장으로만 그리고, 안 보이는 캐릭터는 그리지 않는다
const arEl = document.getElementById('arona');
let last = performance.now();
(function loop(now) {
  const sc = stage.dataset.scene;
  const low = document.documentElement.classList.contains('lowpower');
  if (low && now - last < 1000 / 24 - 2) { requestAnimationFrame(loop); return; }
  const dt = Math.min(low ? 0.1 : 0.05, (now - last) / 1000); last = now;
  if ((sc === 'room' || sc === 'lobby') && (sc === 'room' || arEl.classList.contains('show'))) rig.update(dt);
  requestAnimationFrame(loop);
})(last);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// ───────── 캐릭터 (가운데 자리 3번) ─────────
const arona = $('#arona'), actor = $('#arona .act');
// 동작 크기는 캐릭터 높이 · 너비 비율 단위
function act(name) {
  const H = actor.offsetHeight, W = actor.offsetWidth, ease = 'ease-in-out';
  const yo = (dy, n, dur) => actor.animate([{ transform: 'none' }, { transform: `translateY(${-dy * H}px)` }],
    { duration: dur / 2 * 1000, iterations: n, direction: 'alternate', easing: ease });
  const sh = (from, to, dur, rep) => {
    const k = []; for (let i = 0; i < rep; i++) k.push({ transform: 'none' }, { transform: `translateX(${from * W}px)` }, { transform: 'none' }, { transform: `translateX(${to * W}px)` });
    k.push({ transform: 'none' });
    return actor.animate(k, { duration: dur * 2 * rep * 1000, easing: 'linear' });
  };
  switch (name) {
    case 'a': arona.classList.add('show'); rig.resize(); break;
    case 'd': arona.style.transitionDuration = '600ms'; arona.classList.remove('show'); break;
    case 'dl': arona.animate([{ transform: 'translateX(-50%)' }, { transform: `translateX(calc(-50% - ${innerWidth}px))` }], { duration: 900, easing: 'ease-in' }).finished.then(() => arona.classList.remove('show')); break;
    case 'hophop': yo(0.05, 4, 0.25); break;
    case 'jump': yo(0.03, 2, 0.25); break;
    case 'greeting': yo(-0.04, 2, 0.4); break;
    case 'shake': sh(-0.03, 0.02, 0.08, 2); break;
    case 'stiff': sh(-0.01, 0.01, 0.08, 4); break;
    case 'nod': actor.animate([{ transform: 'none' }, { transform: `translateY(${H * 0.012}px) rotate(-1.5deg)` }, { transform: 'none' }], { duration: 520, iterations: 2, easing: ease }); break;
    case 'wiggle': actor.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-2.5deg)' }, { transform: 'rotate(2.5deg)' }, { transform: 'rotate(0)' }], { duration: 700, easing: ease }); break;
    case 'closeup': arona.classList.add('close'); break;
    default: break;   // h(강조) — 한 명뿐이라 효과 없음
  }
}

// ── 감정 아이콘 (합성 효과음 + 직접 그린 말풍선) ──
const EMO_SVG = {
  balloon: (inner) => `<svg viewBox="0 0 100 100"><path class="bl" d="M50 8C26 8 9 23 9 42c0 13 8 24 21 30l-6 18 20-14c2 0 4 0 6 0 24 0 41-15 41-34S74 8 50 8z"/>${inner}</svg>`,
};
const EMO = {
  Question: EMO_SVG.balloon('<text x="50" y="58" class="gl">?</text>'),
  Exclaim: EMO_SVG.balloon('<text x="50" y="58" class="gl">!</text>'),
  Surprise: EMO_SVG.balloon('<text x="50" y="58" class="gl">?!</text>'),
  Heart: EMO_SVG.balloon('<path class="hf" d="M50 63 31 45c-7-7-1-19 9-17 5 1 8 5 10 8 2-3 5-7 10-8 10-2 16 10 9 17z"/>'),
  Dot: EMO_SVG.balloon('<circle class="d d1" cx="32" cy="44" r="6"/><circle class="d d2" cx="50" cy="44" r="6"/><circle class="d d3" cx="68" cy="44" r="6"/>'),
  Chat: EMO_SVG.balloon('<path class="ln" d="M28 36h44M28 50h30"/>'),
  Respond: '<svg viewBox="0 0 100 100"><path class="rs" d="M30 70 18 46M50 64V32M70 70l12-24"/></svg>',
  Shy: '<svg viewBox="0 0 100 100"><path class="sh" d="M22 66 38 34M42 66 58 34M62 66 78 34"/></svg>',
  Sweat: '<svg viewBox="0 0 100 100"><path class="sw" d="M50 14C42 34 32 46 32 60a18 18 0 0 0 36 0c0-14-10-26-18-46z"/></svg>',
  Twinkle: '<svg viewBox="0 0 100 100"><path class="st1" d="m30 18 5 15 15 5-15 5-5 15-5-15-15-5 15-5z"/><path class="st2" d="m68 34 6 18 18 6-18 6-6 18-6-18-18-6 18-6z"/><path class="st3" d="m34 66 3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/></svg>',
  Music: '<svg viewBox="0 0 100 100"><path class="mu" d="M40 72a10 8 0 1 1-6-10V22l40-8v46a10 8 0 1 1-6-10V30l-28 6z"/></svg>',
  Upset: '<svg viewBox="0 0 100 100"><path class="up" d="M18 50c8-16 18 16 26 0s18 16 26 0 14 8 14 8M24 66c8-12 16 12 24 0s16 12 24 0"/></svg>',
  Angry: '<svg viewBox="0 0 100 100"><path class="an" d="M42 20c0 14-8 22-22 22M58 20c0 14 8 22 22 22M42 80c0-14-8-22-22-22M58 80c0-14 8-22 22-22"/></svg>',
};
EMO.Sigh = EMO.Chat; EMO.Sad = EMO.Sweat; EMO.Tear = EMO.Sweat; EMO.Steam = EMO.Angry; EMO.Bulb = EMO.Exclaim; EMO.Zzz = EMO.Dot;
function emote(name) {
  const r = rig.rig; if (!r) return;
  const el = document.createElement('div'); el.className = 'emo ' + name; el.innerHTML = EMO[name] || EMO.Respond;
  // 머리 오른쪽 위 (모델 좌표 → #arona 안의 % 좌표, 그릴 때 0.94 배율)
  const k = rig.scale ?? 0.94, v = r.emo ? r.emo[1] : r.halo[1] + 0.07;
  const u = r.emo ? r.emo[0] : r.halo[0] + 0.19;
  el.style.left = (50 + (u - 0.5) * k * 100) + '%'; el.style.top = (50 + (v - 0.5) * k * 100) + '%';
  // 학생: 말풍선이 머리 오른쪽에 붙으면 감정 아이콘은 왼쪽 위로 (placeBubble 이 옮긴다)
  if (r.emo && r.face) { el.dataset.l = (50 + ((r.face.cx - (u - r.face.cx)) - 0.5) * k * 100) + '%'; if ($('#bubble').dataset.tail === 'l' && $('#bubble').classList.contains('show')) el.style.left = el.dataset.l; }
  actor.appendChild(el); audio.play('Emo_' + name);
  setTimeout(() => el.remove(), 1700);
}

// ───────── 로비 ─────────
const LINES = {
  none: '아직 연결된 기능이 없어요. 설정 파일에서 연결해 주세요, 선생님!',
  lowBat: '선생님, 배터리가 얼마 안 남았어요……!',
};
let bubbleTimer, bubbleOut;
function bubble(text, ms = 3800, talkMs = Math.min(ms - 400, text.length * 55)) {
  const b = $('#bubble'), t = $('#bubble-text');
  t.innerHTML = [...text].map((ch, i) =>
    ch === ' ' ? ' ' : `<b style="animation-delay:${(i * 0.022).toFixed(3)}s">${esc(ch)}</b>`).join('');
  b.classList.remove('out', 'show'); placeBubble(b); void b.offsetWidth; b.classList.add('show');
  rig.talk(true);
  clearTimeout(bubbleTimer); clearTimeout(bubbleOut);
  bubbleTimer = setTimeout(() => rig.talk(false), talkMs);
  bubbleOut = setTimeout(() => { b.classList.add('out'); b.classList.remove('show'); }, ms);
}
let bubbleAt = null;    // () => {x, y} | null — 말풍선을 붙일 화면 좌표 (업무 화면 장면 속 캐릭터)
// 말풍선은 캐릭터 머리 옆에 붙인다 . 오른쪽에 자리가 없으면 왼쪽, 캐릭터가 없으면 아래쪽 가운데.
function placeBubble(b) {
  const st = b.style; st.left = st.top = st.right = st.bottom = st.maxWidth = ''; delete b.dataset.tail;
  const r = rig.rig, a = arona.getBoundingClientRect();     // .act(반응 동작 중 움직임) 말고 제자리 기준 — 탭 순간 동작 때문에 높이가 들쭉날쭉했다
  const seen = (bubbleAt && bubbleAt()) || r && a.width > 0 && getComputedStyle(arona).display !== 'none' && arona.classList.contains('show') || (r && arona.closest('#workscr:not([hidden])'));
  const W = innerWidth, H = innerHeight, m = 12;
  if (!seen) {                                   // 캐릭터 없음: 하단 독 위 가운데
    b.dataset.tail = 'n'; st.maxWidth = Math.min(W - 2 * m, 560) + 'px';
    const bw = b.offsetWidth;
    st.left = Math.max(m, (W - bw) / 2) + 'px'; st.right = 'auto'; st.top = 'auto';
    st.bottom = Math.round(H * (stage.classList.contains('launcher') ? 0.2 : 0.3)) + 'px';
    return;
  }
  const k = rig.scale ?? 0.94;
  let hx = a.left + (0.5 + (r.head[0] - 0.5) * k) * a.width, hy = a.top + (0.5 + (r.head[1] - 0.5) * k) * a.height;
  const at = bubbleAt && bubbleAt();                    // 업무 화면 대기 동작: 장면 속 말하는 사람 머리 옆
  if (at) { hx = at.x; hy = at.y; }
  const gap = bubbleAt && bubbleAt() ? 46 : Math.max(30, Math.min(a.width * 0.14, W * 0.12));
  // 머리 옆 남는 폭에 맞춘다 (세로 화면에서도 옆에 붙도록). 양쪽 다 좁으면 머리 아래 가로 띠
  const roomR = W - m - (hx + gap), roomL = hx - gap - m;
  const tail = roomR >= Math.min(300, W * 0.42) || roomR >= roomL ? 'l' : 'r';
  const room = tail === 'l' ? roomR : roomL;
  const top = $('#workscr').hidden ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0)
    : $('#workscr .wk-top').getBoundingClientRect().bottom;                          // 업무 창: 헤더 아래로
  const sat = top;
  if (room >= 150) {
    st.maxWidth = Math.min(460, W * 0.5, room) + 'px';
    const bw = b.offsetWidth, bh = b.offsetHeight;
    st.left = (tail === 'l' ? hx + gap : hx - gap - bw) + 'px';
    st.top = Math.max(m + sat, Math.min(H - bh - m, hy - bh * 0.2)) + 'px';
    st.right = st.bottom = 'auto'; b.dataset.tail = tail;
    if (tail === 'l') actor.querySelectorAll('.emo[data-l]').forEach((e) => { e.style.left = e.dataset.l; });
    return;
  }
  st.maxWidth = W - 2 * m + 'px'; const w2 = b.offsetWidth;
  st.left = Math.max(m, Math.min(W - w2 - m, hx - w2 / 2)) + 'px'; st.right = st.bottom = 'auto';
  st.top = Math.min(H - b.offsetHeight - m, hy + a.height * 0.12) + 'px'; b.dataset.tail = 't';
}
/** 바뀔 때만 쓰기 (매초 같은 글자를 다시 쓰면 화면 배치를 다시 계산해서 캐릭터가 끊겨 보인다) */
const setText = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };
function hud() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  const night = d.getHours() >= 19 || d.getHours() < 6;
  $('#room-bg').classList.toggle('night', night); stage.classList.toggle('night', night);
  if (stage.dataset.scene === 'lobby') studentBg();                                          // 팩 배경: 시간대가 바뀌면 다른 그림으로
  syncSysWall();                                                                           // (낮/밤이 바뀌면 기기 배경화면도)
  const wt = $('#wc-time'); if (wt) {
    setText(wt, `${p(d.getHours())}:${p(d.getMinutes())}`);
    setText($('#wc-date'), stage.classList.contains('lock')
      ? `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()]}`
      : `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${'일월화수목금토'[d.getDay()]}요일`);
  }
  setText($('#clock'), `${p(d.getHours())}:${p(d.getMinutes())}`);
  setText($('#credit-date'), `${p(d.getMonth() + 1)}.${p(d.getDate())} ${'일월화수목금토'[d.getDay()]}`);
  pyro();
  if (stage.classList.contains('launcher')) home.widgets();
  setText($('#sensei-name'), (state.name ? state.name + ' ' : '') + '선생님'); setText($('#lv'), String(CFG.level));
}
function showBattery(b) {
  if (!b || b.level == null || b.level < 0) return;
  applyPower(b);
  $('#ap').textContent = `${b.level}/100`;
  $('.pill.ap').classList.toggle('charging', !!b.charging);
  const pv = showBattery.prev; showBattery.prev = { level: b.level, charging: !!b.charging };
  if (pv && stage.dataset.scene === 'lobby') {
    if (!pv.charging && b.charging) situ('charge_on', { n: b.level });
    else if (pv.charging && !b.charging) situ('charge_off', { n: b.level });
    else if (b.charging && b.level >= 100 && pv.level < 100) situ('full');
  }
  if (b.level <= 15 && !b.charging && !showBattery.warned) { showBattery.warned = true; situ('low', { n: b.level }).then((ok) => { if (!ok) bubble(LINES.lowBat); }); }
  if (b.level > 20) showBattery.warned = false;
}
// ───────── 저전력 모드: 끄기 · 자동(배터리 20% 이하이고 충전 중이 아닐 때) · 켜기 ─────────
let lastBat = null;
function applyPower(b = lastBat) {
  if (b) lastBat = b;
  const m = store.get('power', 'auto');
  const on = m === 'on' || (m === 'auto' && lastBat && lastBat.level >= 0 && lastBat.level <= 20 && !lastBat.charging);
  document.documentElement.classList.toggle('lowpower', !!on);
}
applyPower();

// ───────── 오류 기록 (설정 → 오류 기록 복사 → 붙여 넣어 알려 주기) ─────────
const ERR = store.get('errlog', []);
let errT = 0;
function logErr(kind, msg) {
  ERR.push({ t: new Date().toISOString().slice(5, 19).replace('T', ' '), k: kind, m: String(msg).slice(0, 400) });
  while (ERR.length > 80) ERR.shift();
  clearTimeout(errT); errT = setTimeout(() => store.set('errlog', ERR), 500);
}
addEventListener('error', (e) => logErr('error', `${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`));
addEventListener('unhandledrejection', (e) => logErr('promise', e.reason && (e.reason.stack || e.reason.message) || e.reason));
const cErr = console.error.bind(console); console.error = (...a) => { logErr('console', a.map((x) => (x && x.stack) || x).join(' ')); cErr(...a); };
function errReport() {
  const I = isNative ? NV.info() : {};
  return [`[Unofficial] 싯딤의 상자 v${I.version || '-'} · ${I.model || navigator.userAgent} · Android ${I.android || '-'} · 화면 ${innerWidth}×${innerHeight}`,
    ...ERR.map((x) => `[${x.t}] ${x.k}: ${x.m}`)].join('\n');
}

// ───────── 설정 · 배치 백업 / 복원 ─────────
function backupJson() {
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('shittim.') && k !== 'shittim.errlog') ls[k] = localStorage.getItem(k); }
  let prefs = {}; try { prefs = isNative && N.prefsDump ? JSON.parse(N.prefsDump()) : {}; } catch (_) { /* 없음 */ }
  return JSON.stringify({ app: 'shittim-chest', v: 1, at: new Date().toISOString(), ls, prefs });
}
function exportBackup() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  const name = `shittim-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
  const txt = backupJson();
  if (isNative && N.saveFile) {
    const r = N.saveFile(name, txt);
    return bubble(r.startsWith('ERR') ? '백업 파일을 저장하지 못했어요… ' + r.slice(4) : `백업했어요! (${r})`, 6000);
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000); bubble('백업 파일을 내려받았어요!');
}
function importBackup(file) {
  const r = new FileReader();
  r.onload = () => {
    let d; try { d = JSON.parse(r.result); } catch (_) { return bubble('백업 파일을 읽을 수 없어요.'); }
    if (!d || d.app !== 'shittim-chest' || !d.ls) return bubble('싯딤의 상자 백업 파일이 아니에요.');
    if (!confirm(`${(d.at || '').slice(0, 16).replace('T', ' ')} 백업으로 되돌릴까요? 지금 배치와 설정은 바뀌어요.`)) return;
    Object.keys(localStorage).filter((k) => k.startsWith('shittim.') && k !== 'shittim.errlog').forEach((k) => localStorage.removeItem(k));
    for (const [k, v] of Object.entries(d.ls)) localStorage.setItem(k, v);
    if (isNative) { try { if (d.prefs && N.prefsLoad) N.prefsLoad(JSON.stringify(d.prefs)); if (d.ls['shittim.home'] && N.setStr) N.setStr('home', d.ls['shittim.home']); } catch (_) { /* 무시 */ } }
    audio.play('SE_Confirm_02'); bubble('백업을 되돌렸어요! 다시 불러올게요.'); setTimeout(() => location.reload(), 1200);
  };
  r.readAsText(file);
}

// ── 청휘석 칸: 기기 정보 하나를 골라 보여 준다 (설정에서 변경) ──
const PYRO = {
  storage: ['남은 저장공간', () => (isNative ? (NV.device().storageFree / 1e9).toFixed(1) + 'GB' : '—')],
  ram: ['남은 메모리', () => (isNative ? (NV.device().ramFree / 1e9).toFixed(1) + 'GB' : '—')],
  days: ['선생님과 함께한 날', () => { const t = store.get('firstMet', Date.now()); store.set('firstMet', t); return 'D+' + (Math.floor((Date.now() - t) / 864e5) + 1); }],
  uptime: ['기기를 켠 지', () => { const ms = isNative ? NV.device().uptime : performance.now(); const h = Math.floor(ms / 36e5); return h >= 24 ? Math.floor(h / 24) + '일' : h + '시간'; }],
};
/** 'D+' 칸 이름은 지금 캐릭터 이름으로 (아로나와 함께한 날 …) */
const pyroLabel = (k) => (k === PYRO.days ? `${CH().name}${josa(CH().name, '와', '과')} 함께한 날` : k[0]);
let pyroAt = 0;
function pyro(force = false) {
  if (!force && Date.now() - pyroAt < 60000 && $('#pyro').textContent) return;
  pyroAt = Date.now();
  const k = PYRO[store.get('pyro', isNative ? 'storage' : 'days')] || PYRO.days;
  $('#pyro').textContent = k[1]();
  $('.pill.py').title = pyroLabel(k);
}
async function battery() {
  if (isNative) { showBattery(NV.battery()); NV.on('battery', showBattery); return; }
  try {
    const b = await navigator.getBattery();
    const up = () => { const v = Math.round(b.level * 100); $('#ap').textContent = `${v}/100`; if (v <= 15 && !b.charging) bubble(LINES.lowBat); };
    up(); b.addEventListener('levelchange', up);
  } catch (_) { $('#ap').textContent = '100/100'; }
}

function natIcon(a) { return a.pkg ? `<img src="${esc(NV.iconUrl(a.pkg, NAT.themed))}" alt="" onerror="this.src='assets/ui/shittim.svg'">` : '＋'; }
function renderDock() {
  if (isNative) {
    $('#dock').innerHTML = NAT.dock.map((a, i) =>
      `<button data-nat="${i}"${a.pkg ? '' : ' class="empty"'}><i>${natIcon(a)}</i><span>${esc(a.label || '비어 있음')}</span></button>`).join('');
    return;
  }
  $('#dock').innerHTML = APPS.dock.map((a, i) =>
    `<button data-slot="dock" data-i="${i}"${a.url ? '' : ' class="empty"'}>
       <i>${iconHtml(a.icon)}</i><span>${esc(a.name || '비어 있음')}</span></button>`).join('');
}

function openDrawer(o = {}) {
  // 런처 홈에서는 폰처럼 전체 화면 앱 서랍 (페이지 · 폴더 · 검색)
  if (!o.pick && !o.pickForHome && homeStyle() === 'launcher' && stage.dataset.scene === 'lobby') { work.close(); closePanel(); return home.openDrawer(); }
  if (isNative) return openNativeDrawer(false, o.pick || !!o.pickForHome);
    $('#panel-title').textContent = '전체 앱';
  $('#panel-body').innerHTML = `<div id="apps">${APPS.drawer.map((a, i) =>
    `<button data-slot="drawer" data-i="${i}"${a.url ? '' : ' class="empty"'}>
       <i>${iconHtml(a.icon)}</i><span>${esc(a.name || '비어 있음')}</span></button>`).join('')}</div>`;
  $('#panel-body').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-slot]'); if (!b) return;
    audio.play('UI_Button_Touch'); launch(APPS[b.dataset.slot][+b.dataset.i]);
  }, { once: true });
  $('#panel').hidden = false;
}

// ── 런처: 기기의 모든 앱 ──
function openNativeDrawer(edit = false, pick = false) {
    $('#panel-title').textContent = pick ? '추가할 앱을 고르세요' : edit ? '전체 앱 · 편집' : '전체 앱';
  const list = NV.apps(true);
  $('#panel-body').innerHTML = `<div class="drawer-bar"><input id="app-q" type="search" placeholder="앱 검색" autocomplete="off">
      <button class="btn${edit ? ' y' : ''}" id="app-edit">${edit ? '완료' : '편집'}</button></div>
    <div id="apps" class="native${edit ? ' editing' : ''}">${list.map((a) =>
      `<button data-pkg="${esc(a.pkg)}" data-label="${esc(a.label)}"><i><img src="${esc(NV.iconUrl(a.pkg, NAT.themed))}" alt="" loading="lazy"></i><span>${esc(a.label)}</span></button>`).join('')}</div>`;
  const q = $('#app-q');
  q.addEventListener('input', () => {
    const k = q.value.trim().toLowerCase();
    document.querySelectorAll('#apps button').forEach((b) => { b.hidden = !!k && !b.dataset.label.toLowerCase().includes(k) && !b.dataset.pkg.includes(k); });
  });
  $('#app-edit').addEventListener('click', () => { audio.play('UI_Button_Touch'); openNativeDrawer(!edit); });
  $('#apps').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-pkg]'); if (!b) return;
    audio.play('UI_Button_Touch');
    if (typeof pick === 'function') { pick({ pkg: b.dataset.pkg, label: b.dataset.label }); closePanel(); bubble(`${b.dataset.label}을(를) 넣었어요!`); return; }
    if (pick) { home.addApp({ pkg: b.dataset.pkg, label: b.dataset.label }); bubble(`${b.dataset.label}을(를) 홈 화면에 넣었어요!`); return; }
    if (!edit) { closePanel(); return launch({ pkg: b.dataset.pkg }); }
    appActions(b.dataset.pkg, b.dataset.label);
  });
  $('#panel').hidden = false;
}
// 편집 모드에서 앱을 누르면: 하단 바에 넣기 · 앱 정보 · 삭제
function appActions(pkg, label) {
  const box = $('#choices'); box.innerHTML = '';
  const opts = [['홈 화면에 추가', () => { home.addApp({ pkg, label }); bubble(`${label}을(를) 홈 화면에 넣었어요!`); }], ['하단 바에 넣기', () => {
    const i = NAT.dock.findIndex((d) => !d.pkg); const at = i >= 0 ? i : NAT.dock.length - 1;
    NAT.dock[at] = { pkg, label }; saveNat(); renderDock(); bubble(`${label}을(를) 하단 바에 넣었어요!`);
  }], ['앱 정보', () => N.appInfo(pkg)], ['삭제', () => N.uninstall(pkg)], ['취소', () => {}]];
  opts.forEach(([t, f], i) => {
    const b = document.createElement('button'); b.innerHTML = `<span>${esc(label)} · ${t}</span>`; b.style.animationDelay = i * 0.05 + 's';
    b.addEventListener('click', (e) => { e.stopPropagation(); audio.play(t === '취소' ? 'UI_Button_Back' : 'UI_Button_Touch'); box.innerHTML = ''; f(); });
    box.appendChild(b);
  });
}
// ── 런처: 하단 바 편집 ──
function openNativeDockEditor() {
    $('#panel-title').textContent = '하단 바 편집';
  const list = NV.apps(true);
  const opt = (sel) => `<option value="">— 비워 두기 —</option>` + list.map((a) => `<option value="${esc(a.pkg)}"${a.pkg === sel ? ' selected' : ''}>${esc(a.label)}</option>`).join('');
  $('#panel-body').innerHTML = `<div class="edit">${NAT.dock.map((d, i) =>
    `<div class="er nat" data-i="${i}"><i><img src="${d.pkg ? esc(NV.iconUrl(d.pkg, NAT.themed)) : 'assets/ui/shittim.svg'}" alt=""></i><b>${i + 1}</b><select>${opt(d.pkg)}</select></div>`).join('')}
    <div class="row"><span>UI 아이콘 테마 (메신저·일정·상점…)</span><input id="set-theme" type="checkbox"${NAT.themed ? ' checked' : ''}></div>
    <div class="row"><span>기본값으로 되돌리기</span><button class="btn" id="dock-reset">초기화</button></div>
    <p class="note">전체 앱 → 편집에서 앱을 눌러 "하단 바에 넣기"로도 바꿀 수 있어요.</p></div>`;
  $('#panel-body').addEventListener('change', (e) => {
    if (e.target.id === 'set-theme') { NAT.themed = e.target.checked; saveNat(); renderDock(); return openNativeDockEditor(); }
    const row = e.target.closest('.er'); if (!row) return;
    const a = list.find((x) => x.pkg === e.target.value);
    NAT.dock[+row.dataset.i] = a ? { pkg: a.pkg, label: a.label } : { pkg: '', label: '' };
    saveNat(); renderDock(); openNativeDockEditor();
  }, { once: true });
  $('#dock-reset').addEventListener('click', () => { NAT.dock = NV.defaultDock(); saveNat(); renderDock(); openNativeDockEditor(); });
  $('#panel').hidden = false;
}

function openAppEditor() {
  if (isNative) return openNativeDockEditor();
    $('#panel-title').textContent = '앱 편집';
  const rows = (slot, title) => `<h4>${title}</h4>` + APPS[slot].map((a, i) =>
    `<div class="er" data-slot="${slot}" data-i="${i}">
       <input class="ic" value="${esc(a.icon)}" placeholder="🙂" aria-label="아이콘">
       <input class="nm" maxlength="12" value="${esc(a.name)}" placeholder="이름">
       <input class="ur" value="${esc(a.url)}" placeholder="https://…  또는  intent://#Intent;package=…;end" aria-label="주소">
     </div>`).join('');
  $('#panel-body').innerHTML = `<div class="edit">${rows('dock', '하단 바')}${rows('drawer', '전체 앱')}
    <p class="note">앱 직접 실행: <b>intent://#Intent;package=패키지명;end</b><br>
    패키지명은 Play 스토어 주소의 <b>?id=</b> 뒤 문자열입니다. 예) com.kakao.talk<br>
    비워 두면 그 칸은 사용하지 않습니다. 입력하면 바로 저장돼요.</p></div>`;
  $('#panel-body').addEventListener('input', (e) => {
    const row = e.target.closest('.er'); if (!row) return;
    const item = APPS[row.dataset.slot][+row.dataset.i];
    item.icon = row.querySelector('.ic').value.trim();
    item.name = row.querySelector('.nm').value.trim();
    item.url = row.querySelector('.ur').value.trim();
    saveApps(); renderDock();
  });
  $('#panel').hidden = false;
}

function openPanel(kind, sec) {
  const body = $('#panel-body');
  if (kind === 'settings') {
    $('#panel-title').textContent = '설정';
    body.innerHTML = `
      <div class="row"><span>선생님 호칭</span><input id="set-name" type="text" maxlength="16" value="${esc(state.name)}"></div>
      <div class="row"><span>효과음</span><input id="set-vol" type="range" min="0" max="1" step="0.05" value="${state.vol}"></div>
      <div class="row"><span>배경음</span><input id="set-bgm" type="range" min="0" max="1" step="0.05" value="${state.bgm}"></div>
      <div class="row"><span>홈 화면 스타일</span><select id="set-style"><option value="launcher"${homeStyle() === 'launcher' ? ' selected' : ''}>런처 (앱 아이콘)</option><option value="lobby"${homeStyle() === 'lobby' ? ' selected' : ''}>로비 스타일</option></select></div>
      <div class="row"><span>배경</span><select id="set-wall">${WALLS.map((w) => `<option value="${w}"${store.get('wall', 'classroom') === w ? ' selected' : ''}>${WALL_NAME[w]}</option>`).join('')}</select></div>
      <div class="row"><span>등장 캐릭터</span><select id="set-chara">${[...CHARS.map((c) => [c.id, `${c.name}${c.packName ? ` (${c.packName})` : ''}`]), ...(CHARS.length > 1 ? [['random', '랜덤 (화면 전환마다)']] : [])].map(([k, t]) => `<option value="${k}"${store.get('chara', CHARS[0].id) === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="row"><span>비워 두기 배경에서도 캐릭터 표시</span><input id="set-over" type="checkbox"${store.get('charaOver', false) ? ' checked' : ''}></div>
      ${isNative ? '<div class="row"><span>기기 배경화면 · 라이브 배경화면 앱 고르기</span><button class="btn" id="set-wallpick">열기</button></div>' : ''}
      ${isNative ? `<div class="row"><span>기기 배경화면도 같은 배경으로 맞추기 (최근 앱 화면 뒤 · 캐릭터 제외)</span><input id="set-syswall" type="checkbox"${store.get('sysWall', false) ? ' checked' : ''}></div>
      <div class="row"><span>잠금 화면 배경도 같이</span><input id="set-syswall-lock" type="checkbox"${store.get('sysWallLock', false) ? ' checked' : ''}></div>` : ''}
      <div class="row"><span>상황별 대사 (아침 인사 · 충전 · 앱 설치 등)</span><input id="set-situ" type="checkbox"${store.get('situ', true) ? ' checked' : ''}></div>
      <div class="row"><span>캐릭터 혼잣말</span><input id="set-talk" type="checkbox"${store.get('aronaTalk', true) ? ' checked' : ''}></div>
      <div class="row"><span>자원 칸에 표시</span><select id="set-pyro">${Object.entries(PYRO).map(([k, v]) => `<option value="${k}"${store.get('pyro', isNative ? 'storage' : 'days') === k ? ' selected' : ''}>${pyroLabel(v)}</option>`).join('')}</select></div>
      ${launcherSettingsHtml()}
      <h4 id="set-app">앱 관리</h4>
      <div class="row"><span>저전력 모드 (캐릭터 움직임 줄이기)</span><select id="set-power">${[['auto', '자동 (배터리 20% 이하)'], ['on', '항상 켜기'], ['off', '끄기']].map(([k, t]) => `<option value="${k}"${store.get('power', 'auto') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="row"><span>설정 · 홈 배치 백업</span><span class="btns"><button class="btn" id="set-bak">내보내기</button><label class="btn">가져오기<input type="file" accept=".json,application/json" hidden id="set-restore"></label></span></div>
      <div class="row"><span>오류 기록 (<b id="err-n">${ERR.length}</b>개) — 문제가 생기면 복사해서 알려 주세요</span><span class="btns"><button class="btn" id="set-errcopy">복사</button><button class="btn" id="set-errclear">지우기</button></span></div>
      <h4>기타</h4>
      <div class="row"><span>하단 바·전체 앱 목록 (로비 스타일)</span><button class="btn" id="set-apps">앱 편집</button></div>
      <div class="row"><span>정보 · 크레딧 · 오픈소스 라이선스</span><span class="btns"><button class="btn" id="set-about">비공식 안내</button><button class="btn" id="set-credits">크레딧</button></span></div>
      ${isNative ? nativeSettingsHtml() : ''}
      <p class="note unofficial"><b>[Unofficial] 싯딤의 상자</b> v${esc((isNative && NV.info().version) || 'web')} · 비공식 팬메이드 앱입니다.<br>개발 <b>CTkross</b> · NEXON Games / NEXON Korea 와 관련이 없습니다.</p>`;
    $('#set-name').addEventListener('change', (e) => { state.name = e.target.value.trim(); store.set('name', state.name); hud(); });
    $('#set-vol').addEventListener('input', (e) => { state.vol = +e.target.value; store.set('vol', state.vol); audio.setVolume(state.vol); });
    $('#set-vol').addEventListener('change', () => audio.play('Confirm_02'));
    $('#set-bgm').addEventListener('input', (e) => { state.bgm = +e.target.value; store.set('bgm', state.bgm); audio.setBgmVolume(state.bgm); });
    $('#set-style').addEventListener('change', (e) => { store.set('homeStyle', e.target.value); closePanel(); lobby(); });
    $('#set-wall').addEventListener('change', (e) => { store.set('wall', e.target.value); applyWall(); });
    bindLauncherSettings();
    $('#set-talk').addEventListener('change', (e) => store.set('aronaTalk', e.target.checked));
    $('#set-chara').addEventListener('change', (e) => { store.set('chara', e.target.value); if (e.target.value.startsWith('random')) { rollChara(); bubble('이제 화면이 전환될 때마다 캐릭터가 바뀌어요!'); } else setChara(e.target.value); });
    $('#set-over').addEventListener('change', (e) => { store.set('charaOver', e.target.checked); applyWall(); });
    $('#set-syswall')?.addEventListener('change', (e) => { store.set('sysWall', e.target.checked); if (e.target.checked) { if (store.get('wall', 'classroom') === 'system') bubble('지금은 \'비워 두기\' 배경이라 기기 배경화면을 그대로 둬요.'); else { syncSysWall(true); bubble('기기 배경화면을 같은 배경으로 맞췄어요!'); } } });
    $('#set-syswall-lock')?.addEventListener('change', (e) => { store.set('sysWallLock', e.target.checked); syncSysWall(true); });
    $('#set-wallpick')?.addEventListener('click', () => { audio.play('UI_Button_Touch'); store.set('wall', 'system'); applyWall(); N.openSettings('wallpaper'); });
    $('#set-pyro').addEventListener('change', (e) => { store.set('pyro', e.target.value); pyro(true); });
    $('#set-apps').addEventListener('click', () => { audio.play('UI_Button_Touch'); openAppEditor(); });
    $('#set-about').addEventListener('click', () => { audio.play('UI_Button_Touch'); openNotice(false); });
    $('#set-credits').addEventListener('click', () => { audio.play('UI_Button_Touch'); openCredits(); });
    $('#set-situ').addEventListener('change', (e) => store.set('situ', e.target.checked));
    $('#set-power').addEventListener('change', (e) => { store.set('power', e.target.value); applyPower(); audio.play('UI_Button_Touch'); });
    $('#set-bak').addEventListener('click', () => { audio.play('UI_Button_Touch'); exportBackup(); });
    $('#set-restore').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) importBackup(f); e.target.value = ''; });
    $('#set-errcopy').addEventListener('click', async () => {
      audio.play('UI_Button_Touch'); const t = errReport();
      if (isNative && N.copy) N.copy(t); else { try { await navigator.clipboard.writeText(t); } catch (_) { /* 미지원 */ } }
      bubble(ERR.length ? `오류 기록 ${ERR.length}개를 복사했어요. 붙여 넣어 알려 주세요!` : '기록된 오류가 없어요. (기기 정보만 복사했어요)');
    });
    $('#set-errclear').addEventListener('click', () => { ERR.length = 0; store.set('errlog', []); $('#err-n').textContent = '0'; audio.play('UI_Button_Touch'); });
    if (isNative) bindNativeSettings();
    if (sec) setTimeout(() => { const t = $('#set-' + sec), b = $('#panel-body'); if (t) b.scrollTop = t.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 8; }, 30);
  } else {
    if (kind === 'mission') { audio.play('UI_Button_Touch'); return missions.open(sec || 'mission'); }
    $('#panel-title').textContent = kind === 'notice' ? '공지사항' : '미션';
    body.innerHTML = `<div class="msg"><div class="av"></div><div><b>${esc(CH().name)}</b><p>${kind === 'notice' ? '새로운 공지사항은 없어요, 선생님!' : `오늘의 미션: 물 마시기, 스트레칭 하기, 그리고 ${esc(CH().name)}${josa(CH().name, '랑', '이랑')} 놀아주기♪`}</p></div></div>`;
  }
  $('#panel').hidden = false;
}
// ── 홈 화면(런처) 설정 — One UI 홈 설정 항목 ──
const GRIDS = ['auto', '4x5', '4x6', '5x5', '5x6', '6x5', '6x6', '7x4', '8x5'];
function launcherSettingsHtml() {
  const s = home.settings();
  const sel = (id, v, opts) => `<select id="${id}">${opts.map(([k, t]) => `<option value="${k}"${String(v) === String(k) ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  const chk = (id, v) => `<input id="${id}" type="checkbox"${v ? ' checked' : ''}>`;
  const g = GRIDS.map((k) => [k, k === 'auto' ? '자동 (화면에 맞춤)' : k.replace('x', ' × ')]);
  return `<h4 id="set-launcher">홈 화면 (런처)</h4>
      ${isNative ? `<div class="row"><span>상단 상태바 · 하단 내비게이션 바</span>${sel('ls-bars', store.get('showBars', false) ? '1' : '0', [['0', '숨김 (가장자리에서 밀면 잠깐 표시)'], ['1', '항상 표시']])}</div>` : ''}
      <div class="row"><span>하단 UI</span>${sel('ls-bar', s.bar, [['auto', '자동 (넓은 화면만 로비 바)'], ['bar', '로비 하단 바 + 업무 버튼'], ['dock', '독 (일반 홈처럼)']])}</div>
      <div class="row"><span>홈 화면 격자</span>${sel('ls-grid', s.grid, g)}</div>
      <div class="row"><span>앱 서랍 격자</span>${sel('ls-dgrid', s.dgrid, g)}</div>
      <div class="row"><span>아이콘 크기</span><input id="ls-size" type="range" min="70" max="130" step="5" value="${s.iconSize}"></div>
      <div class="row"><span>앱 이름 표시</span>${chk('ls-labels', s.labels)}</div>
      ${isNative ? `<div class="row"><span>아이콘 팩 (노바 · ADW 형식 아이콘 팩 앱)</span>${sel('ls-pack', NV.iconPack(), [['', '기본 (기기 아이콘 · 아이콘 테마 그대로)'], ...NV.iconPacks().map((p) => [p.pkg, p.label])])}</div>` : ''}
      <div class="row"><span>UI 아이콘 테마 (기본: 원래 아이콘)</span>${chk('ls-theme', store.get('themeIcons', false))}</div>
      <div class="row"><span>아이콘 편집 (앱별로 갤러리 이미지 · UI 아이콘)</span><button class="btn" id="ls-icons">열기</button></div>
      <div class="row"><span>홈 화면 배치 잠금</span>${chk('ls-lock', s.lock)}</div>
      <div class="row"><span>새 앱을 홈 화면에 추가</span>${chk('ls-auto', s.autoAdd)}</div>
      <div class="row"><span>위로 밀어 앱 서랍 열기</span>${chk('ls-up', s.swipeUp)}</div>
      <div class="row"><span>아래로 밀어 알림창 열기</span>${chk('ls-down', s.swipeDown)}</div>
      <div class="row"><span>앱 서랍 버튼 표시</span>${chk('ls-appsbtn', s.appsBtn)}</div>
      <div class="row"><span>앱 아이콘 배지</span>${sel('ls-badge', s.badge, [['num', '숫자'], ['dot', '점'], ['off', '끄기']])}${isNative ? '<button class="btn" id="ls-badgeacc">알림 접근 허용</button>' : ''}</div>
      <div class="row"><span>위젯</span><label><input id="ls-wclock" type="checkbox"${s.wClock ? ' checked' : ''}> 시계</label> <label><input id="ls-wbat" type="checkbox"${s.wBat ? ' checked' : ''}> 배터리</label></div>
      <div class="row"><span>기존 홈 앱(One UI 등) 배치 가져오기 · 동기화</span><button class="btn y" id="ls-import">가져오기</button></div>
      <div class="row"><span>숨긴 앱</span><button class="btn" id="ls-hidden">관리 (${s.hidden.length})</button></div>
      <div class="row"><span>홈 화면 배치</span><button class="btn y" id="ls-reset">처음 배치로</button></div>`;
}
function bindLauncherSettings() {
  const on = (id, ev, f) => $('#' + id)?.addEventListener(ev, f);
  on('ls-bars', 'change', (e) => { store.set('showBars', e.target.value === '1'); N.setBars(e.target.value === '1'); });
  on('ls-bar', 'change', (e) => home.set('bar', e.target.value));
  on('ls-grid', 'change', (e) => home.set('grid', e.target.value));
  on('ls-dgrid', 'change', (e) => home.set('dgrid', e.target.value));
  on('ls-size', 'change', (e) => home.set('iconSize', +e.target.value));
  on('ls-labels', 'change', (e) => home.set('labels', e.target.checked));
  on('ls-pack', 'change', (e) => {
    N.setIconPack(e.target.value); store.set('iconRev', (store.get('iconRev', 0) || 0) + 1);
    if (e.target.value && store.get('themeIcons', false)) { store.set('themeIcons', false); if (NAT) NAT.themed = false; const t = $('#ls-theme'); if (t) t.checked = false; }
    home.render(); renderDock(); audio.play('SE_Confirm_02');
    bubble(e.target.value ? '아이콘 팩을 적용했어요!' : '기기 아이콘으로 되돌렸어요!');
  });
  on('ls-theme', 'change', (e) => { store.set('themeIcons', e.target.checked); if (NAT) NAT.themed = e.target.checked; home.render(); renderDock(); });
  on('ls-lock', 'change', (e) => home.set('lock', e.target.checked));
  on('ls-auto', 'change', (e) => home.set('autoAdd', e.target.checked));
  on('ls-up', 'change', (e) => home.set('swipeUp', e.target.checked));
  on('ls-down', 'change', (e) => home.set('swipeDown', e.target.checked));
  on('ls-appsbtn', 'change', (e) => home.set('appsBtn', e.target.checked));
  on('ls-badge', 'change', (e) => { home.set('badge', e.target.value); if (isNative && e.target.value !== 'off' && N.hasBadgeAccess && !N.hasBadgeAccess()) bubble('배지를 보려면 [알림 접근 허용]에서 싯딤의 상자를 켜 주세요!', 5000); });
  on('ls-badgeacc', 'click', () => { audio.play('UI_Button_Touch'); N.openBadgeAccess && N.openBadgeAccess(); });
  on('ls-wclock', 'change', (e) => home.set('wClock', e.target.checked));
  on('ls-wbat', 'change', (e) => home.set('wBat', e.target.checked));
  on('ls-import', 'click', () => { audio.play('UI_Button_Touch'); home.importSheet(); });
  on('ls-icons', 'click', () => { audio.play('UI_Button_Touch'); home.iconEditor(); });
  on('ls-hidden', 'click', () => { audio.play('UI_Button_Touch'); home.hiddenApps(); });
  on('ls-reset', 'click', () => { audio.play('Confirm_01'); home.reset(); bubble('홈 화면을 처음 배치로 되돌렸어요!'); closePanel(); });
}
// ── 출처 · 크레딧 — 누르면 그 주소로 바로 간다 ──
const REPO = 'https://github.com/CTkross7/Shittim-Chest-Public';
const CREDITS = () => [
  ['개발', [
    ['CTkross', 'https://github.com/CTkross7', '[Unofficial] 싯딤의 상자 기획 · 개발'],
    ['소스 코드 · 배포', REPO, '버그 제보 · 새 버전은 여기에서'],
  ]],
  ['캐릭터 팩', CHARS.map((c) => [`${c.name} — ${c.packName || c.pack}`, REPO, `${c.author ? '제작 ' + c.author + ' · ' : ''}${c.license || ''}`])],
  ['원작 표기', [
    ['블루 아카이브 (NEXON Games / NEXON Korea)', 'https://bluearchive.nexon.com', '이 앱은 비공식 팬메이드이며 공식과 관련이 없습니다. 블루 아카이브 관련 권리는 NEXON Games 에 있습니다'],
    ['블루 아카이브 공식 YouTube', 'https://www.youtube.com/channel/UCj0iColXMAjPA92rH-AXVGQ', '배경음: 블루 아카이브 공식 OST (홈 · 업무 화면)'],
    ['넥슨 게임 IP 사용 가이드', 'https://member.nexon.com/policy/gameipguide.aspx', ''],
  ]],
  ['소프트웨어 · 글꼴', [
    ['Simple Icons', 'https://simpleicons.org', '블아 스타일 앱 아이콘의 로고 모양 (CC0) · 각 로고의 상표권은 해당 회사 소유'],
    ['경기천년체', 'https://www.gg.go.kr/contents/contents.do?ciIdx=679&menuId=2457', '경기도 · 무료 배포 서체'],
    ['Zen Dots · Anton (Google Fonts)', 'https://fonts.google.com/specimen/Zen+Dots', 'SIL Open Font License'],
  ]],
];
function openCredits() {
  $('#panel-title').textContent = '정보 · 크레딧';
  $('#panel-body').innerHTML = `<div class="about-head"><b>[Unofficial] 싯딤의 상자</b><span>개발 · CTkross</span><small>비공식 팬메이드 · 비영리 무료 배포</small></div>` +
    CREDITS().map(([h, rows]) => `<h4>${esc(h)}</h4><div class="cr-list">${rows.map(([t, u, d]) =>
      `<button class="crd" data-url="${esc(u)}"><b>${esc(t)}</b>${d ? `<small>${esc(d)}</small>` : ''}<i>${esc(u.replace(/^https?:\/\//, ''))}</i></button>`).join('')}</div>`).join('');
  $('#panel').hidden = false;
}
/** 비공식 안내 — 처음 켤 때 한 번 (설정 → 정보에서 다시 볼 수 있음) */
function openNotice(first) {
  $('#panel-title').textContent = '비공식 팬메이드 안내';
  $('#panel-body').innerHTML = `<div class="about-head"><b>[Unofficial] 싯딤의 상자</b><span>개발 · CTkross</span></div>
    <div class="notice-box">
      <p>이 앱은 <b>비공식 팬메이드 런처</b>입니다. <b>NEXON Games · NEXON Korea</b> 및 블루 아카이브 공식과 <b>관련이 없습니다.</b></p>
      <p>비영리 · 무료로 배포됩니다. 유료로 판매하거나 대가를 받고 배포하는 것은 허용되지 않습니다.</p>
      <p>게임에서 추출한 리소스(모델 · 음성 · 그림 · 효과음)는 들어 있지 않습니다. 아로나 그림과 교실 배경은 새로 그린 팬아트이고, 대사는 직접 썼습니다. 배경음은 블루 아카이브 공식 OST 로, 출처를 표기합니다.</p>
      <p>앱은 설치된 앱 목록 · 배터리 상태를 기기 안에서만 사용하고, 어떤 정보도 밖으로 보내지 않습니다. 인터넷은 새 버전 확인(GitHub)에만 씁니다.</p>
    </div>
    <div class="pick-bar" style="justify-content:center"><button class="btn y" id="notice-ok">${first ? '확인했어요' : '닫기'}</button></div>`;
  $('#panel').hidden = false;
  $('#notice-ok').addEventListener('click', () => { store.set('noticeSeen', true); audio.play('UI_Button_Touch'); closePanel(); });
}
$('#panel-body').addEventListener('click', (e) => {
  const b = e.target.closest('.crd[data-url]'); if (!b) return;
  audio.play('UI_Button_Touch');
  if (isNative) N.openUrl(b.dataset.url); else window.open(b.dataset.url, '_blank', 'noopener');
});
function closePanel() { $('#panel').hidden = true; $('#choices').innerHTML = ''; }

// ───────── 런처 설정 (APK) ─────────
function nativeSettingsHtml() {
  const I = NV.info(), d = NV.device(), b = NV.battery();
  const chk = (id, on) => `<input type="checkbox" id="${id}"${on ? ' checked' : ''}>`;
  const ok = (v) => (v ? '<em class="ok">켜짐</em>' : '<em class="ng">꺼짐</em>');
  return `
    <h4>런처</h4>
    <div class="row"><span>기본 홈 앱 ${ok(I.isDefaultLauncher)}</span><button class="btn" data-sys="home">홈 앱 선택</button></div>
    <div class="row"><span>알림 권한 ${ok(I.notify)}</span><button class="btn" data-sys="notify">허용</button></div>
    <h4>업데이트 · v${esc(I.version || '')}</h4>
    <div class="row"><span>새 버전 자동 확인 (3시간마다)</span>${chk('n-check', I.autoCheck)}</div>
    <div class="row"><span>자동으로 받아서 설치</span>${chk('n-auto', I.autoInstall)}</div>
    <div class="row"><span>앱 설치 허용 ${ok(I.canInstall)}</span><button class="btn" data-sys="install">허용</button></div>
    <div class="row"><span>지금 확인</span><button class="btn y" id="n-update">업데이트 확인</button></div>
    <h4>기기</h4>
    <p class="note">${esc(I.model || '')} · Android ${esc(I.android || '')} · 배터리 ${b.level ?? '-'}%${b.charging ? ' (충전 중)' : ''} · ${b.temp ?? '-'}℃<br>
      저장공간 ${NV.fmtBytes(d.storageFree || 0)} 남음 / ${NV.fmtBytes(d.storageTotal || 0)} · 메모리 ${NV.fmtBytes(d.ramFree || 0)} / ${NV.fmtBytes(d.ramTotal || 0)} · 네트워크 ${esc(d.network || '-')}</p>
    <div class="sysgrid">${[['wifi', 'Wi-Fi'], ['bluetooth', '블루투스'], ['display', '화면'], ['sound', '소리'], ['battery', '배터리'], ['wallpaper', '배경화면'], ['security', '보안·잠금'], ['all', '전체 설정']]
      .map(([k, t]) => `<button class="btn" data-sys="${k}">${t}</button>`).join('')}</div>`;
}
function bindNativeSettings() {
  const body = $('#panel-body');
  body.querySelectorAll('[data-sys]').forEach((b) => b.addEventListener('click', () => { audio.play('UI_Button_Touch'); N.openSettings(b.dataset.sys); }));
  $('#n-check').addEventListener('change', (e) => N.setBool('autoCheck', e.target.checked));
  $('#n-auto').addEventListener('change', (e) => N.setBool('autoInstall', e.target.checked));
  $('#n-update').addEventListener('click', () => { audio.play('UI_Button_Touch'); bubble('새 버전이 있는지 확인하고 있어요…'); N.checkUpdate(); });
}

// ───────── 업데이트 팝업 ─────────
function updatePopup(u) {
  if (!u || !u.version) return;
  const el = $('#upd');
  el.querySelector('.uv').textContent = `v${u.version}`;
  el.querySelector('.un').textContent = (u.notes || '').trim().split('\n').slice(0, 12).join('\n') || '변경 사항이 적혀 있지 않아요.';
  el.querySelector('.bar').style.setProperty('--p', 0); el.classList.remove('busy');
  el.hidden = false; audio.play('SE_Confirm_02');
  if (stage.dataset.scene === 'lobby') speak('talk', { face: '11', em: 'Exclaim' });
}
// 화면에 안 보일 때(다른 앱 실행 중·화면 꺼짐)는 소리·혼잣말을 멈춘다
const visible = () => document.visibilityState === 'visible' && !visible.paused;
document.addEventListener('visibilitychange', () => (visible() ? audio.resume() : audio.suspend()));
if (isNative) {
  NV.on('pause', () => { visible.paused = true; audio.suspend(); });
  NV.on('resume', () => { visible.paused = false; audio.resume(); if (stage.dataset.scene === 'lobby') setTimeout(greetCheck, 600); });
}
if (isNative) {
  NV.on('update', (u) => updatePopup(typeof u === 'string' ? JSON.parse(u) : u));
  NV.on('updateProgress', (d) => { const el = $('#upd'); el.classList.add('busy'); el.querySelector('.bar').style.setProperty('--p', d.p / 100); el.querySelector('.st').textContent = `받는 중… ${d.p}%`; });
  NV.on('updateInstalling', () => { $('#upd .st').textContent = '설치 확인 창에서 [업데이트]를 눌러 주세요.'; });
  NV.on('updateError', (m) => { $('#upd').classList.remove('busy'); bubble(m, 6000); });
  NV.on('wallpaperError', (m) => { store.set('sysWallLast', ''); bubble('기기 배경화면을 바꾸지 못했어요… (' + m + ')', 5000); });
  NV.on('updateNone', (d) => bubble(`최신 버전이에요! (v${d.version})`));
  NV.on('back', () => { if (!$('#panel').hidden) { audio.play('UI_Button_Back'); closePanel(); } else if (!$('#upd').hidden) $('#upd').hidden = true; else if (work.isOpen) { audio.play('UI_Button_Back'); leaveWorkScr(); } else home.back(); });
  NV.on('home', () => { closePanel(); home.back(); home.closeDrawer(); work.close(); $('#upd').hidden = true; $('#splash').classList.remove('on'); if (stage.classList.contains('launcher')) $('#h-pages').scrollTo({ left: 0, behavior: 'smooth' }); });
  NV.on('battery', (b) => home.widgets(b));
  const labels = {}; const keepLabels = () => { try { NV.apps().forEach((a) => { labels[a.pkg] = a.label; }); } catch (_) { /* 없음 */ } }; setTimeout(keepLabels, 3000);
  NV.on('apps', (d) => {
    home.prune(d);
    if (d && d.kind === 'added') { const a = NV.apps(true).find((x) => x.pkg === d.pkg); if (a) { labels[a.pkg] = a.label; situ('app_added', { app: a.label }); } }
    else if (d && d.kind === 'removed' && labels[d.pkg]) situ('app_removed', { app: labels[d.pkg] });
  });
  NV.on('resume', () => home.syncCheck());
  NV.on('insets', (i) => { document.documentElement.style.setProperty('--sat', i.top + 'px'); document.documentElement.style.setProperty('--sab', i.bottom + 'px'); });
  NV.on('resume', () => { setTimeout(() => $('#splash').classList.remove('on'), 300); renderDock(); });
  NV.on('apps', () => { if (!$('#panel').hidden && $('#apps.native')) openNativeDrawer(); });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('#upd button'); if (!b) return;
  if (b.dataset.k === 'later') { audio.play('UI_Button_Back'); $('#upd').hidden = true; }
  if (b.dataset.k === 'go') { audio.play('UI_Button_Touch'); $('#upd').classList.add('busy'); $('#upd .st').textContent = '받기 시작…'; N.installUpdate(); }
});

// ───────── 캐릭터 대사 · 상태 ─────────
const VOICE = PACK_LINES;      // 캐릭터 팩의 대사 (chara.json 의 lines)
const pickOne = (L) => L[(Math.random() * L.length) | 0];
/** 대사 속 이름 자리 ([USERNAME] · {name}). 호칭을 비워 두면 '선생님'만 남긴다 */
const nameIn = (t) => t.replace(/(\[USERNAME\]|\{name\})\s*/g, state.name ? state.name + ' ' : '');
/** 받침에 따라 조사 고르기 (아로나와 / ○○과 …) */
function josa(w, a, b) { const c = (w || '').charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 ? b : a; }
const mood = { state: 'normal', last: performance.now(), timer: 0 };
let exprTimer;
/** 음성 + 자막(말풍선) + 입 움직임 */
/** 대사 한 줄: 음성 + 자막 + 표정(대사에 정해진 얼굴) */
function charaOnScreen() {
  if (!arona.classList.contains('show') || stage.classList.contains('lock') || arona.classList.contains('away')) return false;
  if (arona.closest('#workscr')) return !$('#workscr').hidden && getComputedStyle(arona).display !== 'none';   // 세로 화면 업무 창에는 캐릭터가 없다
  return stage.dataset.scene === 'lobby' || stage.dataset.scene === 'room';
}
/** 대사에 정해진 표정 그대로. 팩에 없는 표정은 기본 표정으로 (무작위로 바꾸지 않는다) */
function faceFor(f) {
  if (!f) return f;
  return rig.has(String(f)) ? String(f) : F0();
}
/** 말하는 중 (음성이 끝날 때까지): 이 동안엔 새 대사를 시작하지 않는다 — 말풍선이 바뀌거나 밀리지 않게 */
let talkUntil = 0;
const talking = () => performance.now() < talkUntil;
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
window.__talk = () => talkUntil; window.__speak = (g) => speak(g);   // 테스트용

/** 대사 내용으로 감정 표시 고르기 — 부끄러운 말엔 Shy, 한숨엔 Sigh … (학생 대사에 무작위 감정을 붙이지 않도록) */
function emoteFor(t) {
  t = t || '';
  if (/부끄|창피|고, 고마|으, 으응|좋아해|두근|♡|❤|얼굴이 빨개|그, 그런|아, 아니/.test(t)) return 'Shy';
  if (/하아…|하아\.|휴우|에휴|후우|한숨/.test(t)) return 'Sigh';
  if (/♪|♬|흥흥|라라|랄라/.test(t)) return 'Music';
  if (/졸려|졸리|낮잠|하아암|쿨쿨|음냐/.test(t)) return 'Zzz';
  if (/화났|짜증|용서 못|정말이지|그만해|이익/.test(t)) return 'Angry';
  if (/미안|죄송|슬퍼|흑/.test(t)) return 'Sweat';
  if (/빰빠|최고|대단|좋아!|해냈|와아|굉장/.test(t)) return 'Twinkle';
  if (/\?/.test(t)) return 'Question';
  if (/!|앗|엣/.test(t)) return 'Exclaim';
  if (/…|\.\.\./.test(t)) return 'Dot';
  return 'Respond';
}
async function speak(group, { face = null, em = null, a = null, when = null } = {}) {
  // only 가 붙은 대사는 그 상황에서만 (예: only: 'workTap' — 업무 화면에서 눌렀을 때만)
  let L = VOICE && VOICE[CHARA] && VOICE[CHARA][group] && VOICE[CHARA][group].filter((x) => !x.only);
  // 업무 화면에서 연달아 찌르기: 처음 몇 번은 보통 대사 → poke 번째에 정해진 대사 (chara.json 의 poke: 4 · 5 …)
  if (when === 'workTap' && L && !talking()) {
    const all = VOICE[CHARA][group], now = performance.now();
    speak.poke = now - (speak.pokeAt || 0) < 15000 ? (speak.poke || 0) + 1 : 1; speak.pokeAt = now;
    const hit = all.filter((x) => x.poke === speak.poke), max = Math.max(0, ...all.map((x) => x.poke || 0));
    if (hit.length) L = hit;
    if (speak.poke >= max) speak.poke = 0;        // 끝까지 가면 처음부터
  }
  if (!L || !L.length || !visible() || !charaOnScreen()) return;     // 캐릭터가 안 보이면 말하지 않는다 (전환 중 · 빈 배경)
  if (talking()) return;
  const line = pickOne(L);
  clearTimeout(exprTimer);          // 앞 대사가 끝나고 걸어 둔 '기본 표정으로' 타이머가 이 대사 중간에 표정을 덮어쓰지 않게
  // 한 대사에 음성이 여러 개면(게임에서 두 번 나눠 말하는 대사) 차례로: 음성마다 그 부분 자막 · 표정
  const parts = line.p && line.p.length ? line.p : [line];
  talkUntil = Infinity;
  if (a) act(a);
  if (em) emote(em === 'auto' ? emoteFor(line.t) : em);         // auto: 대사 내용에 맞는 감정 표시 (부끄러운 말에 화난 표시가 뜨지 않게)
  const clean = (t) => nameIn(t).replace(/\s*\n\s*/g, ' ');
  try {
    for (let i = 0; i < parts.length; i++) {
      const pt = parts[i], last = i === parts.length - 1;
      const f = faceFor(i === 0 ? face || pt.f : pt.f); if (f) rig.expr(f);
      const dur = pt.v ? await audio.voice(CH().base + pt.v) : 0;
      if (!charaOnScreen()) { audio.stopVoice?.(); return; }      // 음성을 읽는 사이 화면이 바뀌었으면 말풍선도 띄우지 않는다
      const text = clean(pt.t);
      const speakMs = dur ? dur * 1000 : Math.max(1800, text.length * 70);
      if (pt.s && pt.s.length > 1) {
        // 한 음성 안에서 말이 이어지는 대사: 줄마다 말풍선 글과 표정을 바꾼다 (대사 데이터의 줄 · 표정 · 표시 시간)
        const w = pt.s.map((x) => x.d > 0 ? x.d : Math.max(900, x.t.length * 90)), tot = w.reduce((a2, b2) => a2 + b2, 0);
        for (let j = 0; j < pt.s.length; j++) {
          const sg = pt.s[j], lastSeg = j === pt.s.length - 1, ms = Math.max(700, speakMs * w[j] / tot);
          if (j > 0) { const f2 = faceFor(sg.f); if (f2) rig.expr(f2); if (em) { const e2 = emoteFor(sg.t); if (e2 !== emoteFor(pt.s[j - 1].t)) emote(e2); } }
          const tj = clean(sg.t);
          rig.talk(dur ? ms : Math.min(ms, tj.length * 55));
          bubble(tj, ms + (lastSeg && last ? 1400 : 500), ms);
          await sleepMs(ms + (lastSeg && !last ? 150 : 0));
          if (!charaOnScreen()) return;
        }
        continue;
      }
      rig.talk(dur ? dur * 1000 : Math.min(speakMs, text.length * 55));
      bubble(text, speakMs + (last ? 1400 : 600), dur ? dur * 1000 : undefined);
      await sleepMs(speakMs + (last ? 0 : 150));                     // 음성이 끝나야 다음 부분 · 다음 대사
      if (!charaOnScreen()) return;
    }
  } finally { talkUntil = performance.now() + 300; }
  // 말이 끝나면 기본 얼굴 · 기본 스탠딩으로
  clearTimeout(exprTimer);
  if (mood.state === 'normal') exprTimer = setTimeout(() => { if (mood.state === 'normal') rig.expr(F0()); }, 800);
}
// ───────── 상황별 대사 (data/situations.json) ─────────
const SITU = PACK_SITU;       // 캐릭터 팩의 상황 대사 (chara.json 의 situ)
const situId = () => CHARA;
/** key 상황의 대사 하나 (캐릭터가 화면에 있을 때만). 했으면 true */
async function situ(key, vars = {}) {
  let L = SITU && SITU[situId()] && SITU[situId()][key];
  if (!L && /^(dawn|morning|noon|afternoon|evening|night|weekend|monday|back_long|back_day)$/.test(key)) {
    if (!visible() || !charaOnScreen() || !store.get('situ', true)) return false;
    speak('in', { em: 'auto' }); return true;   // 상황 대사가 없으면 접속 인사로
  }
  if (!L || !L.length || !visible() || !charaOnScreen() || !store.get('situ', true)) return false;
  if (talking()) return false;
  const line = pickOne(L);
  clearTimeout(exprTimer);
  const t = nameIn(line.t).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? ''));
  if (line.f) rig.expr(faceFor(line.f)); if (line.e) emote(line.e);
  const dur = line.v ? await audio.voice(CH().base + line.v) : 0;
  if (!charaOnScreen()) return false;
  rig.talk(dur ? dur * 1000 : Math.min(2600, t.length * 55));
  bubble(t, Math.max(3200, dur * 1000 + 1400, t.length * 85), dur ? dur * 1000 : Math.min(2600, t.length * 55));
  talkUntil = performance.now() + (dur ? dur * 1000 + 300 : 1200);
  clearTimeout(exprTimer); exprTimer = setTimeout(() => { if (mood.state === 'normal') rig.expr(F0()); }, Math.max(2600, dur * 1000 + 500));
  return true;
}
/** 홈이 보일 때: 하루 첫 인사(시간대 · 요일) / 오랜만에 돌아옴 + 접속 미션 */
function greetCheck() {
  if (!visible()) return;
  const now = Date.now(), seen = store.get('lastSeen', 0), gap = seen ? now - seen : 0, day = dayKey();
  store.set('lastSeen', now);
  missions.bump('open', 1, true);
  if (store.get('greetDay', '') !== day) {
    store.set('greetDay', day);
    const d = new Date(), h = d.getHours(), wd = d.getDay();
    const key = gap > 864e5 ? 'back_day' : h < 5 ? 'dawn' : h < 11 ? (wd === 1 ? 'monday' : wd === 0 || wd === 6 ? 'weekend' : 'morning') : h < 14 ? 'noon' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night';
    setTimeout(() => situ(key), 1200);
  } else if (gap > 6 * 3600e3) setTimeout(() => situ('back_long'), 1200);
}
setInterval(() => { if (visible() && stage.dataset.scene === 'lobby') store.set('lastSeen', Date.now()); }, 60000);
// 혼자 있을 때 하는 일: 팩의 moods ({이름: {f: 표정, e: 감정, look: [x, y]}}) 중 하나 + 그 이름의 대사 묶음.
// moods 가 없는 캐릭터는 혼잣말(cafe) · 터치 대사(talk)만 한다.
const MOOD_LOOK = (st) => { const m = (CH().moods || {})[st] || {}; if (m.f) rig.expr(faceFor(m.f)); if (m.look) rig.look(m.look[0], m.look[1]); return m.e ? { em: m.e } : {}; };
function setMood(st) {
  mood.state = st;
  if (st === 'normal') { rig.expr(F0()); rig.look(0, 0); return; }
  speak(st, MOOD_LOOK(st));
}
// 아무것도 안 하면 혼자 논다. 밤(0~6시)에는 졸기(sleep)가 있으면 존다.
function idleTick() {
  clearTimeout(mood.timer);
  mood.timer = setTimeout(() => {
    if (stage.dataset.scene === 'lobby' && $('#panel').hidden && visible() && arona.classList.contains('show') && store.get('aronaTalk', true) && !(false)) {
      const h = new Date().getHours(), night = h < 6;
      const M = CH().moods && Object.keys(CH().moods);
      if (!M || !M.length) { speak(Math.random() < 0.6 ? 'cafe' : 'talk', { em: 'auto' }); idleTick(); return; }   // 학생: 카페 혼잣말 · 로비 대사
      if (mood.state === 'normal') setMood(night && M.includes('sleep') ? 'sleep' : pickOne(M));
      else if (Math.random() < 0.6) speak(mood.state, {});
      else setMood('normal');
    }
    idleTick();
  }, (CH().talkEvery || 55) * 1000 * (0.65 + Math.random() * 0.7));
}

// ───────── 홈 화면 스타일 · 배경 ─────────
const homeStyle = () => store.get('homeStyle', 'launcher');           // launcher(기본) | lobby(로비 스타일)
const WALLS = isNative ? ['classroom', 'system'] : ['classroom'];
const WALL_NAME = { classroom: '캐릭터 + 배경', system: '비워 두기 (기기 배경화면 · 라이브 배경화면 앱)' };
function applyWall() {
  let w = store.get('wall', 'classroom');
  if (!WALLS.includes(w)) { w = 'classroom'; store.set('wall', w); }
  stage.dataset.wall = w;
  document.documentElement.classList.toggle('see-through', w === 'system' && stage.dataset.scene === 'lobby');
  // 캐릭터: 배경이 있을 때 + '비워 두기'에서도 캐릭터 표시를 켰을 때
  arona.classList.toggle('show', stage.dataset.scene === 'lobby' && (w === 'classroom' || (w === 'system' && store.get('charaOver', false))));
  studentBg();
  bgmSync();
  syncSysWall();
}
/** 캐릭터 팩의 배경 (시간대마다 후보 중 하나, 같은 날 · 같은 시간대면 같은 그림) */
let studBg = null;
function studentBg(force = false) {
  const set = bgsOf(CHARA), rb = $('#room-bg');
  const L = set && (set[slotOf()] || set.day);
  if (!L || !L.length) { if (studBg) { rb.style.backgroundImage = ''; stage.classList.remove('studbg'); studBg = null; } return; }
  const key = CHARA + '|' + slotOf() + '|' + dayKey();
  if (force || studentBg.key !== key || !studBg) {
    const saved = store.get('studBgPick', {});
    studentBg.key = key;
    studBg = saved.key === key && L.includes(saved.bg) ? saved.bg : pickOne(L);
    store.set('studBgPick', { key, bg: studBg });
  }
  const bgv = `url("${new URL(studBg, location.href).href}")`;    // 절대 주소 (CSS 안 상대 주소는 css/ 기준으로 풀린다)
  if (rb.style.backgroundImage !== bgv) rb.style.backgroundImage = bgv;
  stage.classList.add('studbg');
}
/** 기기 배경화면도 같은 배경으로 (최근 앱 화면 뒤). 비트맵(jpg · png · webp) 배경일 때만 */
function syncSysWall(force = false) {
  if (!isNative || !N.setWallpaper || !store.get('sysWall', false)) return;
  const w = store.get('wall', 'classroom'); if (w === 'system') return;
  if (!studBg || !/\.(jpe?g|png|webp)$/i.test(studBg) || store.get('chara', CHARA).startsWith('random')) return;
  const key = studBg + (store.get('sysWallLock', false) ? '+lock' : '');
  if (!force && store.get('sysWallLast', '') === key) return;
  store.set('sysWallLast', key);
  N.setWallpaper(studBg, store.get('sysWallLock', false));
}
/** 배경 음악: 캐릭터 팩의 bgm ({home, work}) — 없으면 조용히 */
let workBgm = false;
function bgmSync() {
  const base = stage.dataset.scene === 'lobby';
  const B = CH().bgm || {};
  const name = !base ? null : workBgm ? B.work || B.home : store.get('wall', 'classroom') === 'classroom' ? B.home : null;
  if (name) { if (audio.bgmName !== name) audio.playBgm(name); }
  else if (audio.bgmName) audio.stopBgm(0.8);
}
function cycleWallpaper() {
  const i = (WALLS.indexOf(store.get('wall', 'classroom')) + 1) % WALLS.length;
  store.set('wall', WALLS[i]); applyWall(); bubble(`배경: ${WALL_NAME[WALLS[i]]}`);
}
const openSheet = (title, html) => { $('#panel-title').textContent = title; $('#panel-body').innerHTML = html; $('#panel').hidden = false; $('#panel-body').scrollTop = 0; return $('#panel-body'); };
const home = createHome({ $, store, NV, isNative, CFG, audio, esc, bubble, launch,
  openDrawer: (o) => openDrawer(o), openSettings: (sec) => openPanel('settings', sec), cycleWallpaper,
  sheet: openSheet,
  closeSheet: () => closePanel(),
  memo: () => { const L = VOICE && VOICE[CHARA] && VOICE[CHARA].talk && VOICE[CHARA].talk.filter((x) => !x.only); if (!L || !L.length) return '선생님, 오늘도 힘내요!'; return nameIn(L[Math.floor(Math.random() * L.length)].t).replace(/\n/g, ' '); },
  memoName: () => CH().name,
  tapChara: () => speak('talk'),
  openWork: () => openWorkScr(),
  openMissions: (t) => missions.open(t),
  tapEmpty: (e) => {           // 빈 곳을 누른 자리가 캐릭터면 캐릭터가 반응
    if (!arona.classList.contains('show')) return;
    const r = arona.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x > 0.25 && x < 0.75 && y > 0 && y < 0.7) aronaTap(e);
  } });
async function openWorkScr() {
  if (work.isOpen) return; await splash(450); work.open();
  splashOut(); missions.bump('work', 1, true);
}
async function leaveWorkScr() { if (!work.isOpen) return; await splash(400); work.close(); splashOut(); }
const charaName = () => CH().name;
const missions = createMissions({ $, store, NV, isNative, audio, esc, bubble, situ, visible, sheet: openSheet,
  badge: (n) => home.setIntBadge('mission', n) });
const work = createWork({ openMissions: (t) => missions.open(t), nextEvent: () => null, hm: (t) => missions.hm(t), leave: leaveWorkScr, $, NV, isNative, audio, esc, bubble, openDrawer: (o) => openDrawer(o), openSettings: () => openPanel('settings'), openCredits,
  // 업무 화면에도 캐릭터가 왼쪽에 선다 — 모델 요소를 잠시 옮긴다
  onOpen: () => {
    $('#workscr').insertBefore(arona, $('#workscr .wk-main')); arona.classList.add('show'); rig.resize();
    workBgm = true; bgmSync();
    setTimeout(() => speak('in', { a: 'greeting' }), 500);
  },
  onClose: () => { workBgm = false; $('#s-room').insertBefore(arona, $('#s-room #wallclock')); applyWall(); rig.resize(); if (!charaOnScreen()) { audio.stopVoice?.(); $('#bubble').classList.remove('show'); } } });
function lobby() {
  scene('lobby');
  const L = homeStyle() === 'launcher';
  stage.classList.toggle('launcher', L);
  if (L) { home.render(); home.widgets(isNative ? NV.battery() : null); if (isNative) N.setBars(store.get('showBars', false)); }   // 기본: 상태바·내비게이션 바 숨김 (가장자리에서 밀면 잠깐 나타남)
  applyWall();
  setTimeout(greetCheck, 400);
  if (L) { hud(); battery(); idleTick(); return; } rig.expr(F0()); arona.classList.remove('close'); arona.classList.add('show'); renderDock(); hud(); battery();
  mood.state = 'normal';
  setTimeout(() => speak('in', { a: 'greeting', em: 'auto' }), 900);
  idleTick();
}
setInterval(hud, 10000);

$('#lobby').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  audio.play('UI_Button_Touch');
  if (b.dataset.nat) { const a = NAT.dock[+b.dataset.nat]; return a.pkg ? launch(a) : openNativeDockEditor(); }
  if (b.dataset.slot) return launch(APPS[b.dataset.slot][+b.dataset.i]);
  if (b.dataset.act === 'drawer') return openWorkScr();
  if (b.dataset.act === 'clock') return isNative ? launch({ url: 'intent://#Intent;action=android.intent.action.SHOW_ALARMS;end' }) : launch({ url: CFG.clockApp });
  if (b.dataset.act === 'pyro') { const k = PYRO[store.get('pyro', isNative ? 'storage' : 'days')] || PYRO.days; return bubble(`${pyroLabel(k)}: ${$('#pyro').textContent} — 설정에서 다른 정보로 바꿀 수 있어요!`); }
  if (b.dataset.act) return openPanel(b.dataset.act);
});
$('#panel-close').addEventListener('click', () => { audio.play('UI_Button_Back'); closePanel(); });
$('#panel').addEventListener('click', (e) => { if (e.target.id === 'panel') closePanel(); });
arona.addEventListener('pointerdown', (e) => {
  // 업무 화면: 몸 위를 누르면 로비처럼 대사
  if (arona.closest('#workscr')) {
    const r = arona.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x > 0.22 && x < 0.78 && y > 0 && y < 0.62) { e.stopPropagation(); aronaTap(e); }   // 몸 위를 눌렀을 때만
    return;
  }
  if (stage.dataset.scene === 'lobby' && !stage.classList.contains('launcher')) { e.stopPropagation(); aronaTap(e); }
});
function aronaTap(e) {
  idleTick();
  if (talking()) return;          // 말하는 중엔 터치로 대사를 끊거나 넘기지 않는다
  // 혼자 놀던 중(졸기 등)이면 깜짝 놀라 돌아온다 (팩에 '<상태>Exit' 대사가 있으면 그 대사)
  if (mood.state !== 'normal') {
    const g = mood.state + 'Exit';
    setMood('normal'); return speak(VOICE[CHARA] && VOICE[CHARA][g] ? g : 'talk', { a: 'stiff', face: 'surprised', em: 'Surprise' });
  }
  const r = arona.getBoundingClientRect(), head = (e.clientY - r.top) / r.height < 0.3, p = CH();
  const when = arona.closest('#workscr') ? 'workTap' : null;     // 업무 화면에서 직접 누름 (연달아 찌르기 대사)
  const a = pickOne(head ? p.head : p.tap);
  speak('talk', { a, em: 'auto', when });     // 표정은 대사에 정해진 것, 감정 표시는 대사 내용으로
}

// 포인터를 따라 고개를 돌린다 (손을 떼면 천천히 정면으로)
let lookTimer;
stage.addEventListener('pointermove', (e) => {
  const sc = stage.dataset.scene;
  if (sc !== 'room' && sc !== 'lobby') return;
  rig.look((e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2);
  clearTimeout(lookTimer); lookTimer = setTimeout(() => rig.look(0, 0), 2600);
});

// ───────── 배경화면 모드 ─────────
// UI 없이 캐릭터만 살아 움직인다. Wallpaper Engine(PC)·웹 라이브 월페이퍼 앱에서 이 주소를 쓰면 된다.
function wallpaper() {
  stage.classList.add('wall');
  scene('lobby'); studentBg(); arona.classList.add('show'); hud(); battery();
  setInterval(hud, 5000);
  idleTick();
  // 소리를 쓰려면 화면을 한 번 누르면 된다 (브라우저 자동재생 정책)
  addEventListener('pointerdown', async function once() {
    removeEventListener('pointerdown', once);
    await audio.unlock(); bgmSync();
  });
}

// ───────── 시작 ─────────
// 부팅 연출 없이 바로 홈. 처음 한 번은 비공식 안내 (설정 → 정보에서 다시 볼 수 있음)
async function start() {
  if (!isNative) try { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); } catch (_) { /* 전체화면 미지원 */ }
  $('#power').hidden = true;
  await audio.unlock();
  lobby();
  if (!store.get('noticeSeen', false)) setTimeout(() => openNotice(true), 600);
}
if (params.get('mode') === 'wallpaper') wallpaper();
else if (isNative) nativeStart();
else $('#power').addEventListener('click', start);

async function nativeStart() {
  $('#power').hidden = true;
  await audio.unlock();
  lobby();
  if (!store.get('noticeSeen', false)) setTimeout(() => openNotice(true), 600);
  const just = N.getPref('justUpdated');
  if (just && just !== 'null' && just !== 'undefined') { N.clearPref('justUpdated'); setTimeout(() => { situ('updated').then((ok) => { if (!ok) bubble(`v${just} 으로 업데이트했어요, 선생님!`, 5000); }); }, 1800); }
  const pend = N.pendingUpdate(); if (pend && pend !== 'null') setTimeout(() => updatePopup(JSON.parse(pend)), 2500);
}
hud();
if (!isNative && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
