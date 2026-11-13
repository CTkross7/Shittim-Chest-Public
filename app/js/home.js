import { openIconPicker, srcOf, suggest } from './iconlib.js';
// 런처 홈 화면 — One UI 홈처럼: 앱 아이콘 페이지 · 폴더 · 독(또는 로비 하단 바) · 위젯 · 앱 서랍 · 편집 모드.
//
// 데이터 (localStorage 'shittim.home' + 앱 설정 백업):
//   { items: [앱 | 폴더], dock: [앱], drawer: [앱 | 폴더] }
//   앱 = { pkg, label, pos? } (APK) · { url, name, icon, pos? } (브라우저) · { int: 'settings'|'work'|'mission', label } (런처 기능)
//   폴더 = { folder: '이름', color?, items: [앱…], pos? }
//   pos = [페이지, 열, 행] — 빈 칸에 놓으면 그 칸에 그대로 남는다.
// 런처 설정 (store 'launcher'): 아래 LDEF 참고. 아이콘 바꾸기 (store 'icons'): { 키: 'ui:이름' | dataURL }
//
// 목록 기호(w): h = 홈 · a = 앱 서랍 · d = 독 · f = 열린 폴더 · s = 서랍 검색 결과

const LONG = 420;            // 길게 누르기(ms)
const MOVE = 14;             // 이만큼 움직이면 끌기/밀기 (손가락 떨림은 누르기로 본다)
export const LDEF = {
  bar: 'auto',               // 하단 UI: auto(넓은 화면만 로비 바) | bar(항상 로비 바 + 업무) | dock(항상 독)
  grid: 'auto', dgrid: 'auto', // 홈 / 앱 서랍 격자: auto | '4x5' | '4x6' | '5x5' | '5x6' | '6x5' | '6x6' | '7x4' | '8x5'
  lock: false,               // 홈 화면 배치 잠금
  autoAdd: false,            // 새로 설치한 앱을 홈 화면에 추가
  labels: true,              // 앱 이름 표시
  iconSize: 100,             // 아이콘 크기 %
  swipeDown: true,           // 아래로 밀어 알림창
  swipeUp: true,             // 위로 밀어 앱 서랍
  appsBtn: true,             // 앱 서랍 버튼 표시
  badge: 'num',              // 앱 아이콘 배지: off | dot | num
  hidden: [],                // 숨긴 앱 (서랍에서 안 보임 · 검색에는 나옴)
  wClock: true, wBat: true,  // 위젯
};
const COLORS = ['', '#5aa9e6', '#7fd1ae', '#f4c35a', '#f08a8a', '#b48ef0', '#9aa4b2'];

export function createHome(ctx) {
  const { $, store, NV, isNative, CFG, audio, launch, esc, openDrawer, openSettings, bubble } = ctx;
  const root = $('#home'), pagesEl = $('#h-pages'), dotsEl = $('#h-dots'), dockEl = $('#h-dock');
  const folderEl = $('#folder'), menuEl = $('#hmenu'), editEl = $('#h-edit');
  const drawerEl = $('#h-drawer'), dPages = $('#d-pages'), dDots = $('#d-dots'), dQ = $('#d-q'), dRes = $('#d-results');
  const S = () => ({ ...LDEF, ...store.get('launcher', {}) });
  const setS = (k, v) => { const o = store.get('launcher', {}); o[k] = v; store.set('launcher', o); };
  let data = load();
  const G = { h: { cols: 4, rows: 5 }, a: { cols: 4, rows: 5 } };
  const disp = new Map();     // 화면에 그릴 칸 (저장된 칸이 격자 밖이거나 겹칠 때만 임시로 다름)
  let results = [], badgeMap = {}; const intBadge = {};
  const isWide = () => { const b = S().bar; return b === 'bar' || (b === 'auto' && Math.min(innerWidth, innerHeight) >= 560 && innerWidth > innerHeight * 1.15); };
  const maxDock = () => (isWide() ? (innerWidth < 700 ? 5 : 9) : 6);

  // ───────── 데이터 ─────────
  const INTERNAL = [{ int: 'settings', label: '런처 설정' }, { int: 'work', label: '업무' }, { int: 'mission', label: '미션' }];
  const webApps = () => [...(CFG.dock || []), ...(CFG.drawer || [])].filter((a) => a.url);
  function defaults() {
    if (!isNative) { const all = webApps(); return { dock: all.slice(0, 5), items: [...all.slice(5), INTERNAL[0]], drawer: [] }; }
    const apps = NV.apps(true);
    const used = new Set();
    const pick = (a) => { used.add(a.pkg); return { pkg: a.pkg, label: a.label }; };
    const dock = NV.defaultDock().filter((d) => d.pkg).slice(0, 5).map((d) => { used.add(d.pkg); return d; });
    const groups = [
      ['기본', (p) => /calculator|calendar|clock|settings|camera|contacts|dialer|myfiles|documentsui|vending|chrome|sbrowser|gallery|photos/.test(p)],
      ['Samsung', (p) => /^com\.(samsung|sec)\./.test(p)],
      ['Google', (p) => /^com\.google\./.test(p)],
    ];
    const items = [];
    for (const [name, test] of groups) {
      const g = apps.filter((a) => !used.has(a.pkg) && test(a.pkg)).map(pick);
      if (g.length > 1) items.push({ folder: name, items: g });
      else g.forEach((x) => { used.delete(x.pkg); });
    }
    apps.filter((a) => !used.has(a.pkg)).forEach((a) => items.push(pick(a)));
    items.push({ ...INTERNAL[0] });
    return { dock, items, drawer: [] };
  }
  function ok(d) { return d && Array.isArray(d.items) && Array.isArray(d.dock); }
  function load() {
    let d = store.get('home', null);
    if (!ok(d)) { try { d = JSON.parse(NV.backup.get('home') || 'null'); } catch (_) { d = null; } }   // 웹 저장소가 비면 앱 설정에서 되살린다
    if (!ok(d)) return null;
    if (!Array.isArray(d.drawer)) d.drawer = [];
    return d;
  }
  let saveT = 0;
  const save = () => {
    if (!data) return;
    store.set('home', data);
    clearTimeout(saveT); saveT = setTimeout(() => NV.backup.set('home', JSON.stringify(data)), 400);
  };
  const keyOf = (a) => a.pkg || a.url || (a.int && 'int:' + a.int) || a.folder;
  const nameOf = (a) => a.label || a.name || a.folder || '';
  const bare = (a) => { const { pos, ...r } = a; return r; };       // 독·폴더로 옮길 때 칸 정보는 버린다
  const flat = (L) => { const o = []; const walk = (a) => (a.folder ? a.items.forEach(walk) : o.push(a)); L.forEach(walk); return o; };

  // 설치 여부. 앱 업데이트 중에는 잠깐 목록에서 빠지므로, 없어진 앱은 배치를 지우지 않고 숨겨 둔다.
  // 10분 넘게 계속 없거나 '삭제됨' 알림이 오면 그때 정리한다.
  let installed = null;
  const isIn = (a) => !isNative || !a.pkg || !installed || installed.has(a.pkg);
  function refreshInstalled() {
    if (!isNative) return;
    installed = new Set(NV.apps(true).map((x) => x.pkg));
    const miss = store.get('missing', {}), now = Date.now(), all = data ? flat([...data.items, ...data.dock, ...data.drawer]) : [];
    const gone = [];
    for (const a of all) if (a.pkg && !installed.has(a.pkg)) { miss[a.pkg] = miss[a.pkg] || now; if (now - miss[a.pkg] > 600000) gone.push(a.pkg); }
    for (const k of Object.keys(miss)) if (installed.has(k)) delete miss[k];
    store.set('missing', miss);
    if (gone.length) gone.forEach(forget);
  }
  /** 정말 지워진 앱: 홈 · 독 · 서랍 · 폴더에서 뺀다 */
  function forget(pkg) {
    if (!data) return;
    const keep = (a) => (a.folder ? (a.items = a.items.filter(keep), a.items.length > 0) : a.pkg !== pkg);
    data.items = data.items.filter(keep); data.dock = data.dock.filter(keep); data.drawer = data.drawer.filter(keep);
    const miss = store.get('missing', {}); delete miss[pkg]; store.set('missing', miss);
  }
  // 서랍: 설치된 모든 앱이 꼭 한 번씩 (새 앱은 뒤 빈 칸에) + 런처 기능
  function syncDrawer() {
    refreshInstalled();
    const all = [...(isNative ? NV.apps(true).map((a) => ({ pkg: a.pkg, label: a.label })) : webApps()), ...INTERNAL];
    const have = new Map(all.map((a) => [keyOf(a), a]));
    const seen = new Set();
    const keep = (a) => {
      if (a.folder) { a.items = a.items.filter(keep); return a.items.length > 0; }
      const k = keyOf(a); if (seen.has(k)) return false;                       // 중복만 정리
      if (!have.has(k) && !(isNative && a.pkg)) return false;                   // (웹) 설정에서 빠진 것
      seen.add(k); const n = have.get(k); if (n && n.label) a.label = n.label; return true;
    };
    data.drawer = data.drawer.filter(keep);
    all.filter((a) => !seen.has(keyOf(a))).sort((x, y) => nameOf(x).localeCompare(nameOf(y), 'ko'))
      .forEach((a) => data.drawer.push({ ...a }));
  }
  // 새로 설치된 앱 → (설정 시) 홈 화면에도
  function newApps() {
    if (!isNative || !data) return;
    const now = NV.apps(true).map((a) => a.pkg), known = store.get('knownApps', null);
    store.set('knownApps', now);
    if (!known || !S().autoAdd) return;
    const k = new Set(known);
    const onHome = new Set(flat([...data.items, ...data.dock]).map(keyOf));
    NV.apps(true).filter((a) => !k.has(a.pkg) && !onHome.has(a.pkg)).forEach((a) => data.items.push({ pkg: a.pkg, label: a.label }));
  }

  // ───────── 아이콘 ─────────
  const customIcon = (a) => srcOf(store.get('icons', {})[keyOf(a)]);
  function iconImg(a) {
    const c = customIcon(a);
    if (c) return `<img src="${esc(c)}" alt="" draggable="false">`;
    if (a.int === 'settings') return '<img src="assets/ui/settings.svg" alt="" draggable="false">';
    if (a.int === 'mission') return '<img src="assets/ui/mission.svg" alt="" draggable="false">';
    if (a.int === 'work') return '<img src="assets/ui/shittim.svg" alt="" draggable="false">';
    if (a.pkg) return `<img src="${esc(NV.iconUrl(a.pkg, store.get('themeIcons', false)))}" alt="" draggable="false" loading="lazy" onerror="this.src='assets/ui/shittim.svg'">`;
    if (/\.(png|jpe?g|webp|svg)$/i.test(a.icon || '')) return `<img src="${esc(a.icon)}" alt="" draggable="false">`;
    return `<em>${esc(a.icon || '▫️')}</em>`;
  }
  function badgeOf(a) {
    const m = S().badge; if (m === 'off') return '';
    const one = (x) => (x.int ? intBadge[x.int] || 0 : badgeMap[x.pkg] || 0);
    const n = a.folder ? a.items.reduce((s, x) => s + one(x), 0) : one(a);
    if (!n) return '';
    return m === 'dot' ? '<i class="bdg dot"></i>' : `<i class="bdg">${n > 99 ? '99+' : n}</i>`;
  }
  // 홈 화면 위젯 (칸을 여러 개 차지) — 시계 2×1 · 배터리 1×1 · 달력 2×2 · 캐릭터 메모 2×1
  const WIDGETS = { clock: ['시계', 2, 1], battery: ['배터리', 1, 1], calendar: ['달력', 2, 2], memo: ['캐릭터 메모', 2, 1] };
  const spanOf = (a) => (a.widget ? [(WIDGETS[a.widget] || [0, 1, 1])[1], (WIDGETS[a.widget] || [0, 1, 1])[2]] : [1, 1]);
  function widgetBody(a) {
    if (a.widget === 'clock') return '<span class="wg-in"><b class="wg-t"></b><small class="wg-d"></small></span>';
    if (a.widget === 'battery') return '<span class="wg-in"><svg viewBox="0 0 44 44"><circle class="t" cx="22" cy="22" r="19"/><circle class="v" cx="22" cy="22" r="19"/></svg><b class="wg-b"></b></span>';
    if (a.widget === 'memo') return '<span class="wg-in"><i class="wg-av"></i><p class="wg-m"></p></span>';
    if (a.widget === 'calendar') {
      const d = new Date(), y = d.getFullYear(), m = d.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
      let g = '일월화수목금토'.split('').map((x) => `<i class="h">${x}</i>`).join('') + '<i></i>'.repeat(first);
      for (let k = 1; k <= days; k++) g += `<i${k === d.getDate() ? ' class="on"' : ''}>${k}</i>`;
      return `<span class="wg-in"><b>${m + 1}월</b><span class="cal">${g}</span></span>`;
    }
    return '';
  }
  function cell(a, where, i) {
    const p = disp.get(a) || a.pos, [sw, sh] = spanOf(a);
    const at = p && (where === 'h' || where === 'a') ? ` style="grid-column:${p[1] + 1} / span ${sw};grid-row:${p[2] + 1} / span ${sh}"` : '';
    if (a.widget) return `<button class="hi wg wg-${esc(a.widget)}" data-w="${where}" data-i="${i}"${at}>${widgetBody(a)}</button>`;
    if (a.folder) {
      const mini = a.items.filter(isIn).slice(0, 4).map((x) => `<i>${iconImg(x)}</i>`).join('');
      return `<button class="hi folder" data-w="${where}" data-i="${i}"${at}><span class="ic fold"${a.color ? ` style="--fc:${esc(a.color)}"` : ''}>${mini}${badgeOf(a)}</span><b>${esc(a.folder)}</b></button>`;
    }
    return `<button class="hi" data-w="${where}" data-i="${i}"${at}><span class="ic">${iconImg(a)}${badgeOf(a)}</span><b>${esc(nameOf(a))}</b></button>`;
  }

  // ───────── 격자 배치 ─────────
  function measure(el, w) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const want = S()[w === 'h' ? 'grid' : 'dgrid'];
    if (want && want !== 'auto') { const [c, rr] = want.split('x').map(Number); G[w] = { cols: c, rows: rr }; return true; }
    const portrait = innerHeight > innerWidth;
    const k = S().iconSize / 100;
    const cw = (portrait ? Math.max(76, r.width / (innerWidth < 600 ? 4 : 5)) : Math.max(92, Math.min(130, r.width / 7))) * Math.max(0.85, k);
    const ch = portrait ? cw * 1.2 : cw * 1.05;
    G[w] = { cols: Math.max(3, Math.floor(r.width / cw)), rows: Math.max(2, Math.floor(r.height / ch)) };
    return true;
  }
  /** 저장된 칸은 그대로 두고, 칸이 없는 것만 첫 빈 칸을 준다. 격자 밖·겹침은 화면에서만 옮긴다.
   *  페이지는 사용자가 지울 때까지 빈 채로도 남는다 (data.np). → 페이지 수 */
  function layout(L, w, show) {
    const { cols, rows } = G[w], per = cols * rows, used = new Set(), lost = [];
    const cellsOf = (p, [sw, sh]) => { const o = []; for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) o.push(p[0] * per + (p[2] + y) * cols + p[1] + x); return o; };
    const fits = (p, sz) => p[0] >= 0 && p[1] >= 0 && p[2] >= 0 && p[1] + sz[0] <= cols && p[2] + sz[1] <= rows && cellsOf(p, sz).every((k) => !used.has(k));
    const take = (p, sz) => cellsOf(p, sz).forEach((k) => used.add(k));
    for (const a of L) {
      disp.delete(a);
      if (!show(a)) continue;                                   // 숨김 · 업데이트 중인 앱은 칸을 차지하지 않는다
      const sz = spanOf(a);
      if (Array.isArray(a.pos) && fits(a.pos, sz)) { take(a.pos, sz); continue; }
      lost.push(a);
    }
    for (const a of lost) {
      const sz = spanOf(a);
      let np = null;
      for (let pg = 0; !np && pg < 200; pg++) for (let r = 0; !np && r <= rows - sz[1]; r++) for (let c = 0; !np && c <= cols - sz[0]; c++) if (fits([pg, c, r], sz)) np = [pg, c, r];
      if (!np) continue;
      take(np, sz);
      if (!Array.isArray(a.pos)) a.pos = np; else disp.set(a, np);
    }
    let maxP = 0;
    L.forEach((a) => { if (show(a)) { const p = disp.get(a) || a.pos; if (p) maxP = Math.max(maxP, p[0]); } });
    data.np = data.np || {};
    data.np[w] = Math.max(data.np[w] || 1, maxP + 1);
    return data.np[w];
  }
  /** 페이지 추가 · 삭제 (홈: 그 페이지의 바로가기를 지움 / 서랍: 앱을 다른 페이지 빈 칸으로) */
  function addPage(w) { data.np = data.np || {}; data.np[w] = (data.np[w] || 1) + 1; save(); w === 'h' ? render() : renderDrawer(); const el = w === 'h' ? pagesEl : dPages; setTimeout(() => el.scrollTo({ left: (data.np[w] - 1) * el.clientWidth, behavior: 'smooth' }), 50); }
  function delPage(w) {
    const el = w === 'h' ? pagesEl : dPages, L = w === 'h' ? data.items : data.drawer;
    const p = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)), n = (data.np && data.np[w]) || 1;
    if (n <= 1) return bubble('페이지가 하나뿐이라 지울 수 없어요.');
    if (w === 'h' && locked()) return;
    const on = (a) => (disp.get(a) || a.pos || [])[0] === p;
    if (w === 'h') data.items = data.items.filter((a) => !on(a));
    else L.forEach((a) => { if (on(a)) a.pos = null; });
    (w === 'h' ? data.items : data.drawer).forEach((a) => { if (a.pos && a.pos[0] > p) a.pos[0]--; });
    data.np[w] = n - 1; save();
    w === 'h' ? render() : renderDrawer();
    bubble(w === 'h' ? '페이지를 지웠어요. (앱은 앱 서랍에 그대로 있어요)' : '페이지를 지웠어요. 그 페이지의 앱은 빈 칸으로 옮겼어요.');
  }
  function paint(L, w, el, dots, show = () => true) {
    const n = layout(L, w, show), { cols, rows } = G[w];
    let html = '';
    for (let p = 0; p < n; p++) {
      html += `<section class="hp" data-w="${w}" data-p="${p}" style="--cols:${cols};--rows:${rows}">` +
        L.map((a, i) => (show(a) && (disp.get(a) || a.pos) && (disp.get(a) || a.pos)[0] === p ? cell(a, w, i) : '')).join('') + '</section>';
    }
    const page = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    el.innerHTML = html;
    el.scrollLeft = Math.min(page, n - 1) * el.clientWidth;
    dots.innerHTML = n > 1 ? Array.from({ length: n }, (_, i) => `<i data-p="${i}"></i>`).join('') : '';
    syncDots(el, dots);
    if (w === 'h') widgets();
  }
  function applyLook() {
    const s = S();
    root.classList.toggle('nolabel', !s.labels);
    root.classList.toggle('noappsbtn', !s.appsBtn);
    root.classList.toggle('no-wclock', !s.wClock);
    root.classList.toggle('no-wbat', !s.wBat);
    root.style.setProperty('--is', s.iconSize / 100);
  }
  function render() {
    if (!data) { data = defaults(); newApps(); }
    applyLook();
    const wide = isWide();
    root.classList.toggle('wide', wide);
    dockEl.innerHTML = data.dock.map((a, i) => (isIn(a) ? cell(a, 'd', i) : '')).join('') +
      (wide && data.dock.length < maxDock() && !S().lock ? '<button class="hi add" data-add="1"><span class="ic"><em>＋</em></span><b>추가</b></button>' : '');
    dockEl.style.setProperty('--n', wide ? maxDock() : Math.max(4, data.dock.length));
    if (installed === null) refreshInstalled();
    if (measure(pagesEl, 'h')) paint(data.items, 'h', pagesEl, dotsEl, isIn);     // 아직 화면에 없으면 칸을 건드리지 않는다
    if (!drawerEl.hidden) renderDrawer();
    save();
  }
  function syncDots(el, dots) {
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === i));
  }
  for (const [el, dots] of [[pagesEl, dotsEl], [dPages, dDots]]) {
    el.addEventListener('scroll', () => syncDots(el, dots), { passive: true });
    dots.addEventListener('click', (e) => { const d = e.target.closest('i'); if (d) el.scrollTo({ left: +d.dataset.p * el.clientWidth, behavior: 'smooth' }); });
  }
  let rzT = 0;
  addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (root.offsetParent) render(); }, 120); });

  // ───────── 페이지 넘기기 (손가락을 따라 움직이고 놓으면 맞춰 선다) ─────────
  function snap(el, dx, dt) {
    const w = el.clientWidth, n = el.querySelectorAll('.hp').length;
    const v = Math.abs(dx) / Math.max(1, dt);
    let i = Math.round(el.scrollLeft / w);
    const from = Math.round((el.scrollLeft + dx) / w);
    if (Math.abs(dx) > w * 0.15 || v > 0.35) i = from + (dx < 0 ? 1 : -1);
    i = Math.max(0, Math.min(n - 1, i));
    el.scrollTo({ left: i * w, behavior: 'smooth' });
  }

  // ───────── 앱 서랍 ─────────
  function renderDrawer() {
    if (measure(dPages, 'a')) { const hid = new Set(S().hidden); paint(data.drawer, 'a', dPages, dDots, (a) => isIn(a) && !hid.has(keyOf(a))); }
    search();
  }
  function search() {
    const k = dQ.value.trim().toLowerCase();
    drawerEl.classList.toggle('searching', !!k);
    if (!k) { dRes.innerHTML = ''; results = []; return; }
    results = flat(data.drawer).filter(isIn).filter((a) => nameOf(a).toLowerCase().includes(k) || (a.pkg || '').includes(k));
    dRes.innerHTML = results.length ? results.map((a, i) => cell(a, 's', i)).join('') : '<p class="d-none">찾는 앱이 없어요.</p>';
  }
  dQ.addEventListener('input', search);
  function openAppDrawer() {
    if (!data) data = defaults();
    syncDrawer();
    dQ.value = '';
    drawerEl.hidden = false; drawerEl.classList.remove('in'); void drawerEl.offsetWidth; drawerEl.classList.add('in');
    dPages.scrollLeft = 0; renderDrawer(); save();
  }
  function closeAppDrawer() { if (drawerEl.hidden) return false; drawerEl.hidden = true; dQ.blur(); return true; }
  $('#d-close').addEventListener('click', () => { audio.play('UI_Button_Back'); closeAppDrawer(); });

  const list = (w) => (w === 'd' ? data.dock : w === 'f' ? openFolder.cur.items : w === 'a' ? data.drawer : w === 's' ? results : data.items);
  const itemAt = (btn) => list(btn.dataset.w)[+btn.dataset.i];

  // ───────── 실행 ─────────
  function open(btn) {
    if (btn.dataset.add) { audio.play('UI_Button_Touch'); return openDrawer({ pick: (app) => { data.dock.push(app); save(); render(); } }); }
    const a = itemAt(btn); if (!a) return;
    audio.play('UI_Button_Touch');
    if (a.folder) return openFolder(a, list(btn.dataset.w));
    if (a.widget) {
      if (a.widget === 'clock') return launch({ url: 'intent://#Intent;action=android.intent.action.SHOW_ALARMS;end' });
      if (a.widget === 'battery') return isNative ? NV.N.openSettings('battery') : null;
      if (a.widget === 'calendar') return launch({ url: 'intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_CALENDAR;end' });
      if (a.widget === 'memo') { memoT = 0; widgets(); return ctx.tapChara?.(); }
    }
    if (a.int) { closeAppDrawer(); if (!folderEl.hidden) closeFolder(); return a.int === 'work' ? ctx.openWork() : a.int === 'mission' ? ctx.openMissions('mission') : openSettings(); }
    const rect = btn.querySelector('.ic').getBoundingClientRect();
    btn.classList.add('launching');
    setTimeout(() => btn.classList.remove('launching'), 600);
    launch(a.pkg ? { pkg: a.pkg } : a, rect);
    if (btn.dataset.w === 'a' || btn.dataset.w === 's') setTimeout(closeAppDrawer, 500);
  }

  // ───────── 폴더 ─────────
  function openFolder(f, owner) {
    openFolder.cur = f; openFolder.owner = owner || data.items; openFolder.t = performance.now();
    folderEl.querySelector('.fname').value = f.folder;
    folderEl.querySelector('.fbox').style.setProperty('--fc', f.color || '');
    drawFolder();
    folderEl.hidden = false;
  }
  function drawFolder() {
    const f = openFolder.cur; if (!f) return;
    folderEl.querySelector('.fgrid').innerHTML = f.items.map((a, i) => cell(a, 'f', i)).join('') +
      (S().lock && openFolder.owner !== data.drawer ? '' : '<button class="hi fadd" data-fadd="1"><span class="ic"><em>＋</em></span><b>앱 추가</b></button>');
    folderEl.querySelector('.fcolors').innerHTML = COLORS.map((c) => `<i data-c="${c}" style="--c:${c || 'rgba(225,232,242,.8)'}"${(f.color || '') === c ? ' class="on"' : ''}></i>`).join('');
  }
  folderEl.querySelector('.fcolors').addEventListener('click', (e) => {
    const c = e.target.closest('i[data-c]'); if (!c || !openFolder.cur) return;
    audio.play('UI_Button_Touch'); openFolder.cur.color = c.dataset.c || undefined;
    folderEl.querySelector('.fbox').style.setProperty('--fc', c.dataset.c); drawFolder(); save();
  });
  /** 폴더에 앱 추가 — 체크해서 여러 개 */
  function folderAdd() {
    const f = openFolder.cur, owner = openFolder.owner;
    const pool = owner === data.drawer ? flat(data.drawer) : (isNative ? NV.apps(true).map((a) => ({ pkg: a.pkg, label: a.label })) : webApps());
    const inF = new Set(f.items.map(keyOf));
    const body = ctx.sheet('폴더에 앱 추가', `<div class="pick-list">${pool.filter((a) => !inF.has(keyOf(a))).map((a, i) =>
      `<label class="pick"><input type="checkbox" data-i="${i}"><span class="ic">${iconImg(a)}</span><b>${esc(nameOf(a))}</b></label>`).join('')}</div>
      <div class="pick-bar"><button class="btn y" id="pick-ok">추가</button></div>`);
    const cand = pool.filter((a) => !inF.has(keyOf(a)));
    body.querySelector('#pick-ok').addEventListener('click', () => {
      const sel = [...body.querySelectorAll('input:checked')].map((x) => cand[+x.dataset.i]);
      for (const a of sel) {
        // 같은 목록에 따로 있던 것은 폴더로 옮긴다
        const i = owner.findIndex((x) => !x.folder && keyOf(x) === keyOf(a)); if (i >= 0) owner.splice(i, 1);
        f.items.push(bare(a));
      }
      ctx.closeSheet(); audio.play('SE_Confirm_02'); drawFolder(); save(); render();
    });
  }
  /** 폴더가 1개 이하로 줄면 풀어서 그 자리에 둔다 */
  function tidyFolder(f, owner) {
    const i = owner.indexOf(f); if (i < 0) return;
    if (f.items.length === 1) owner.splice(i, 1, { ...f.items[0], ...(f.pos ? { pos: f.pos } : {}) });
    else if (f.items.length === 0) owner.splice(i, 1);
  }
  function closeFolder() {
    if (folderEl.hidden) return false;
    const f = openFolder.cur;
    if (f) { f.folder = folderEl.querySelector('.fname').value.trim() || '폴더'; tidyFolder(f, openFolder.owner); }
    folderEl.hidden = true; openFolder.cur = null; save(); render();
    return true;
  }
  // 바깥(흐린 배경)을 눌렀다 뗐을 때만 닫는다. 터치 기기는 손을 뗀 뒤 '클릭'을 그 자리에 다시 보내는데,
  // 폴더를 연 그 터치의 클릭이 방금 뜬 배경에 맞아 곧바로 닫히던 문제가 있었다.
  let bgDown = false;
  folderEl.addEventListener('pointerdown', (e) => { bgDown = e.target === folderEl && performance.now() - openFolder.t > 350; });
  folderEl.addEventListener('pointerup', (e) => { if (bgDown && e.target === folderEl) { audio.play('UI_Button_Back'); closeFolder(); } bgDown = false; });
  folderEl.querySelector('.fname').addEventListener('change', () => { if (openFolder.cur) openFolder.cur.folder = folderEl.querySelector('.fname').value.trim() || '폴더'; save(); });

  // ───────── 아이콘 바꾸기 ─────────
  function iconPicker(a, after) {
    const k = keyOf(a);
    openIconPicker({
      sheet: ctx.sheet, closeSheet: ctx.closeSheet, esc, audio, NV, srcOf, app: a,
      title: `아이콘 바꾸기 · ${nameOf(a)}`, current: store.get('icons', {})[k] || null,
      currentHtml: `<span class="ic">${iconImg(a)}</span><small>지금</small>`,
      onPick: (v) => {
        const m = store.get('icons', {}); if (v) m[k] = v; else delete m[k]; store.set('icons', m);
        ctx.closeSheet(); audio.play('SE_Confirm_02'); render(); if (!folderEl.hidden) drawFolder();
        if (after) after();
      },
    });
  }


  // ───────── 메뉴 (길게 누르기) ─────────
  function menu(x, y, opts, head = '') {
    menuEl.innerHTML = head + opts.map(([t, , cls], i) => `<button data-k="${i}"${cls ? ` class="${cls}"` : ''}>${esc(t)}</button>`).join('');
    menuEl.hidden = false;
    // 화면 안에 다 들어오게: 높이는 화면까지, 넘치면 메뉴 안에서 스크롤 (내비게이션 바 위로)
    const sab = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;
    const room = innerHeight - 16 - sab;
    menuEl.style.maxHeight = room + 'px'; menuEl.scrollTop = 0;
    const r = { width: menuEl.offsetWidth, height: menuEl.offsetHeight };   // 열리는 애니메이션(확대) 영향 없이
    menuEl.style.left = Math.min(innerWidth - r.width - 8, Math.max(8, x - r.width / 2)) + 'px';
    let top = y + 12 + r.height <= room + 8 ? y + 12 : y - r.height - 12;     // 아래에 자리가 없으면 위로
    menuEl.style.top = Math.max(8, Math.min(room + 8 - r.height, top)) + 'px';
    const t0 = performance.now();
    menuEl.onclick = (e) => {
      const b = e.target.closest('button'); if (!b || performance.now() - t0 < 350) return;   // 길게 누른 손을 뗄 때 생기는 클릭은 무시
      e.stopPropagation(); menuEl.hidden = true; audio.play('UI_Button_Touch'); opts[+b.dataset.k][1]();
    };
  }
  const hideMenu = () => { menuEl.hidden = true; };
  const locked = () => { if (!S().lock) return false; bubble('홈 화면 배치가 잠겨 있어요. 홈 화면 설정에서 풀 수 있어요!'); return true; };
  const toHome = (a) => {
    if (locked()) return;
    const k = keyOf(a);
    if (flat(data.items).some((x) => keyOf(x) === k)) return bubble('이미 홈 화면에 있어요!');
    data.items.push(bare(a)); save(); render(); bubble(`${nameOf(a)}을(를) 홈 화면에 넣었어요!`);
  };
  function itemMenu(btn, x, y) {
    const w = btn.dataset.w, i = +btn.dataset.i, a = itemAt(btn);
    const L = list(w), opts = [];
    const dn = isWide() ? '바' : '독';
    const homeSide = w === 'h' || w === 'd' || (w === 'f' && openFolder.owner === data.items);
    const drawerSide = w === 'a' || w === 's' || (w === 'f' && openFolder.owner === data.drawer);
    let head = '';
    if (a.widget) {
      opts.push(['위젯 삭제', () => { if (locked()) return; L.splice(i, 1); save(); render(); }, 'warn']);
      return menu(x, y, opts, `<div class="mh"><b>${esc(WIDGETS[a.widget][0])} 위젯</b></div>`);
    }
    if (a.folder) {
      opts.push(['폴더 열기', () => openFolder(a, L)]);
      opts.push(['이름 · 색상 바꾸기', () => { openFolder(a, L); setTimeout(() => folderEl.querySelector('.fname').focus(), 50); }]);
      if (drawerSide) opts.push(['홈 화면에 추가', () => { if (locked()) return; data.items.push({ folder: a.folder, color: a.color, items: a.items.map(bare) }); save(); render(); bubble(`${a.folder} 폴더를 홈 화면에 넣었어요!`); }]);
      opts.push(['폴더 풀기', () => { if (homeSide && locked()) return; L.splice(i, 1, ...a.items.map((x, k) => (k === 0 && a.pos ? { ...x, pos: a.pos } : bare(x)))); save(); render(); }]);
      if (homeSide) opts.push(['폴더 삭제 (홈에서)', () => { if (locked()) return; L.splice(i, 1); save(); render(); }, 'warn']);
    } else {
      // 앱 바로가기 (기본 홈 앱일 때 시스템이 알려 준다)
      if (a.pkg) {
        const sc = NV.shortcuts(a.pkg);
        sc.forEach((s) => opts.push(['↗ ' + s.label, () => NV.N.startShortcut(a.pkg, s.id), 'sc']));
      }
      if (drawerSide) opts.push(['홈 화면에 추가', () => toHome(a)]);
      if (drawerSide && data.dock.length < maxDock()) opts.push([`${dn}에 넣기`, () => { if (locked()) return; data.dock.push(bare(a)); save(); render(); bubble(`${nameOf(a)}을(를) ${dn}에 넣었어요!`); }]);
      if (w === 'h' && data.dock.length < maxDock()) opts.push([`${dn}에 넣기`, () => { if (locked()) return; L.splice(i, 1); data.dock.push(bare(a)); save(); render(); }]);
      if (w === 'd') {
        opts.push(['다른 앱으로 바꾸기', () => { if (locked()) return; openDrawer({ pick: (app) => { data.dock[i] = app; save(); render(); } }); }]);
        if (i > 0) opts.push(['앞으로', () => { [L[i - 1], L[i]] = [L[i], L[i - 1]]; save(); render(); }]);
        if (i < L.length - 1) opts.push(['뒤로', () => { [L[i + 1], L[i]] = [L[i], L[i + 1]]; save(); render(); }]);
        opts.push([`${dn}에서 빼서 홈으로`, () => { if (locked()) return; L.splice(i, 1); data.items.push(bare(a)); save(); render(); }]);
      }
      if (w === 'f') opts.push(['폴더에서 빼기', () => { if (homeSide && locked()) return; L.splice(i, 1); openFolder.owner.push(bare(a)); closeFolder(); }]);
      if (w === 'h' || drawerSide) opts.push(['폴더로 묶기', () => { if (w === 'h' && locked()) return; folderize(a, drawerSide ? data.drawer : data.items); }]);
      opts.push(['아이콘 바꾸기', () => iconPicker(a)]);
      if (drawerSide && a.pkg) opts.push([S().hidden.includes(a.pkg) ? '숨김 해제' : '앱 숨기기', () => {
        const h = new Set(S().hidden); if (h.has(a.pkg)) h.delete(a.pkg); else h.add(a.pkg); setS('hidden', [...h]); renderDrawer();
        bubble(h.has(a.pkg) ? `${nameOf(a)}을(를) 숨겼어요. 검색하면 찾을 수 있어요.` : `${nameOf(a)}을(를) 다시 보이게 했어요.`);
      }]);
      if (isNative && a.pkg) opts.push(['앱 정보', () => NV.N.appInfo(a.pkg)]);
      if (homeSide) opts.push(['홈에서 제거', () => { if (locked()) return; L.splice(i, 1); if (w === 'f') closeFolder(); else { save(); render(); } }, 'warn']);
      if (isNative && a.pkg) opts.push(['삭제 (앱 제거)', () => NV.N.uninstall(a.pkg), 'warn']);
      head = `<div class="mh"><span class="ic">${iconImg(a)}</span><b>${esc(nameOf(a))}</b></div>`;
    }
    menu(x, y, opts, head);
  }
  function drawerMenu(x, y) {
    menu(x, y, [
      ['가나다순 정렬', () => {
        const folders = data.drawer.filter((a) => a.folder).map((f) => ({ folder: f.folder, color: f.color, items: f.items.map(bare) }));
        const inF = new Set(folders.flatMap((f) => f.items.map(keyOf)));
        data.drawer = [...folders, ...flat(data.drawer).map(bare).filter((a) => !inF.has(keyOf(a))).sort((p, q) => nameOf(p).localeCompare(nameOf(q), 'ko'))];
        if (data.np) data.np.a = 1;
        save(); renderDrawer();
      }],
      ['새 폴더', () => { data.drawer.push({ folder: '새 폴더', items: [] }); save(); renderDrawer(); }],
      ['폴더 모두 풀기', () => { data.drawer = data.drawer.flatMap((a) => (a.folder ? a.items.map(bare) : [a])); save(); renderDrawer(); }],
      ['페이지 추가', () => addPage('a')],
      ['이 페이지 삭제', () => delPage('a')],
      ['기존 홈 앱에서 가져오기', () => importSheet()],
      ['아이콘 편집', () => iconEditor()],
      ['숨긴 앱 관리', () => hiddenApps()],
      ['홈 화면 설정', () => openSettings('launcher')],
      ['서랍 닫기', () => closeAppDrawer()],
    ]);
  }
  /** 앱 하나를 폴더로: 있는 폴더에 넣거나, 다른 앱들을 골라 새 폴더를 만든다 (홈 · 앱 서랍 공통) */
  function folderize(a, owner) {
    const take = (x) => {                         // 목록(또는 그 안의 폴더)에서 빼고 꺼낸 것을 돌려준다
      const i = owner.indexOf(x); if (i >= 0) { owner.splice(i, 1); return x; }
      for (const f of owner.filter((o) => o.folder)) { const j = f.items.indexOf(x); if (j >= 0) { f.items.splice(j, 1); tidyFolder(f, owner); return x; } }
      return x;
    };
    const folders = owner.filter((o) => o.folder);
    const others = owner.filter((o) => !o.folder && o !== a);
    const body = ctx.sheet(`폴더로 묶기 · ${nameOf(a)}`, `
      ${folders.length ? `<h4>있는 폴더에 넣기</h4><div class="cr-list">${folders.map((f, i) => `<button class="crd" data-f="${i}"><b>📁 ${esc(f.folder)}</b><small>앱 ${f.items.length}개</small></button>`).join('')}</div>` : ''}
      <h4>새 폴더 만들기</h4>
      <div class="row"><span>폴더 이름</span><input id="fz-name" type="text" maxlength="16" value="새 폴더"></div>
      <p class="cr-note">함께 넣을 앱을 고르세요 (안 골라도 돼요).</p>
      <div class="pick-list">${others.map((x, i) => `<label class="pick"><input type="checkbox" data-i="${i}"><span class="ic">${iconImg(x)}</span><b>${esc(nameOf(x))}</b></label>`).join('')}</div>
      <div class="pick-bar"><button class="btn y" id="fz-ok">새 폴더 만들기</button></div>`);
    body.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
      const f = folders[+b.dataset.f]; f.items.push(bare(take(a)));
      ctx.closeSheet(); audio.play('SE_Confirm_02'); save(); render(); bubble(`${nameOf(a)}을(를) ${f.folder} 폴더에 넣었어요!`);
    }));
    body.querySelector('#fz-ok').addEventListener('click', () => {
      const pos = owner.includes(a) ? a.pos : null;
      const sel = [...body.querySelectorAll('.pick input:checked')].map((x) => others[+x.dataset.i]);
      const items = [a, ...sel].map((x) => bare(take(x)));
      const name = body.querySelector('#fz-name').value.trim() || '새 폴더';
      owner.push({ folder: name, items, ...(pos ? { pos } : {}) });
      ctx.closeSheet(); audio.play('SE_Confirm_02'); save(); render(); bubble(`${name} 폴더를 만들었어요!`);
    });
  }
  /** 위젯 추가: 지금 보고 있는 페이지의 빈 자리에 (없으면 새 페이지) */
  function widgetPicker() {
    const s = S();
    const body = ctx.sheet('위젯', `<p class="cr-note">눌러서 지금 페이지에 놓아요. 놓은 뒤 길게 눌러 옮기거나 지울 수 있어요.</p>
      <div class="cr-list">${Object.entries(WIDGETS).map(([k, [t, w, h]]) => `<button class="crd" data-wg="${k}"><b>${t}</b><small>${w} × ${h} 칸</small></button>`).join('')}</div>
      <h4>화면 위쪽 고정 위젯</h4>
      <div class="row"><span>시계</span><input id="wg-top-c" type="checkbox"${s.wClock ? ' checked' : ''}></div>
      <div class="row"><span>배터리</span><input id="wg-top-b" type="checkbox"${s.wBat ? ' checked' : ''}></div>`);
    body.querySelector('#wg-top-c').addEventListener('change', (e) => { setS('wClock', e.target.checked); applyLook(); });
    body.querySelector('#wg-top-b').addEventListener('change', (e) => { setS('wBat', e.target.checked); applyLook(); });
    body.querySelectorAll('[data-wg]').forEach((b) => b.addEventListener('click', () => {
      if (locked()) return;
      const k = b.dataset.wg, [sw, sh] = spanOf({ widget: k }), { cols, rows } = G.h, per = cols * rows;
      const page = Math.round(pagesEl.scrollLeft / Math.max(1, pagesEl.clientWidth));
      const occ = new Set(); data.items.forEach((o) => { if (!isIn(o)) return; const q = disp.get(o) || o.pos; if (!q) return; const [a2, b2] = spanOf(o); for (let y = 0; y < b2; y++) for (let x = 0; x < a2; x++) occ.add(q[0] * per + (q[2] + y) * cols + q[1] + x); });
      let at = null;
      for (let pg = page; !at && pg < page + 50; pg++) for (let r = 0; !at && r <= rows - sh; r++) for (let c = 0; !at && c <= cols - sw; c++) {
        let ok2 = true; for (let y = 0; ok2 && y < sh; y++) for (let x = 0; x < sw; x++) if (occ.has(pg * per + (r + y) * cols + c + x)) ok2 = false;
        if (ok2) at = [pg, c, r];
      }
      data.items.push({ widget: k, pos: at });
      ctx.closeSheet(); audio.play('SE_Confirm_02'); editMode(false); save(); render();
      if (at && at[0] !== page) { setTimeout(() => pagesEl.scrollTo({ left: at[0] * pagesEl.clientWidth, behavior: 'smooth' }), 60); bubble('이 페이지에 자리가 없어서 다음 페이지에 놓았어요!'); }
    }));
  }
  // ───────── 기존 홈 앱(One UI 홈 등)에서 배치 가져오기 · 동기화 ─────────
  const CATS = { 0: '게임', 1: '음악·오디오', 2: '동영상', 3: '사진', 4: '소셜·메신저', 5: '뉴스·읽기', 6: '지도·교통', 7: '업무·생산성', 8: '접근성' };
  function readLauncher() { try { return JSON.parse(NV.N.importLayout ? NV.N.importLayout() : '{}'); } catch (_) { return {}; } }
  function layoutHash(res) {
    const f = (res.favorites || []).map((r) => [r._id, r.container, r.screen, r.cellX, r.cellY, r.pkg, r.itemType, r.title].join(',')).join(';');
    let h = 5381; for (let i = 0; i < f.length; i++) h = ((h << 5) + h + f.charCodeAt(i)) | 0; return String(h);
  }
  /** favorites 표 → 우리 배치. 홈(-100) · 독(-101) · 앱스 화면(-102) · 폴더(그 밖의 container = 폴더 _id) */
  function applyLauncher(res, { home = true, drawer = true } = {}) {
    const fav = res.favorites || [];
    if (!fav.length) return null;
    const apps = new Map(NV.apps(true).map((a) => [a.pkg, a]));
    const appOf = (r) => (r.pkg && apps.has(r.pkg) ? { pkg: r.pkg, label: apps.get(r.pkg).label } : null);
    const isApp = (r) => r.itemType === 0 || r.itemType === 1 || r.itemType === 6;
    const order = (x, y) => (x.rank ?? 0) - (y.rank ?? 0) || (x.cellY ?? 0) - (y.cellY ?? 0) || (x.cellX ?? 0) - (y.cellX ?? 0);
    const kids = (fid) => { const seen = new Set(); return fav.filter((r) => r.container === fid && isApp(r)).sort(order).map(appOf).filter((a) => a && !seen.has(a.pkg) && seen.add(a.pkg)); };
    const build = (cont) => {
      const rows = fav.filter((r) => r.container === cont && (isApp(r) || r.itemType === 2));
      const screens = [...new Set(rows.map((r) => r.screen ?? 0))].sort((x, y) => x - y);
      const out = [], seen = new Set();
      for (const r of rows.sort(order)) {
        const pos = [screens.indexOf(r.screen ?? 0), r.cellX ?? 0, r.cellY ?? 0];
        if (r.itemType === 2) { const it = kids(r._id); if (it.length) out.push({ folder: r.title || '폴더', items: it, pos }); continue; }
        const a = appOf(r); if (a && !seen.has(a.pkg)) { seen.add(a.pkg); out.push({ ...a, pos }); }
      }
      return { list: out, pages: Math.max(1, screens.length) };
    };
    const prev = JSON.parse(JSON.stringify(data));
    const got = { home: 0, dock: 0, drawer: 0, folders: 0 };
    data.np = data.np || {};
    if (home) {
      const h = build(-100);
      if (h.list.length) {
        data.items = h.list; data.np.h = h.pages; got.home = h.list.length;
        if (!flat(data.items).some((a) => a.int === 'settings')) data.items.push({ ...INTERNAL[0] });
      }
      const dock = fav.filter((r) => r.container === -101 && isApp(r)).sort((x, y) => (x.screen ?? 0) - (y.screen ?? 0) || order(x, y)).map(appOf).filter(Boolean);
      if (dock.length) { data.dock = dock.slice(0, maxDock()); got.dock = dock.length; }
    }
    if (drawer) {
      const d = build(-102);
      if (d.list.length) { data.drawer = d.list; data.np.a = d.pages; got.drawer = d.list.length; }
    }
    got.folders = [...data.items, ...data.drawer].filter((a) => a.folder).length;
    if (!got.home && !got.drawer && !got.dock) { data = prev; return null; }
    store.set('homePrev', prev);
    syncDrawer(); save(); render();
    return got;
  }
  /** 앱 카테고리로 폴더 자동 정리 (기존 홈 배치를 읽을 수 없는 기기용) */
  function autoFolders(w = 'a') {
    const all = isNative ? NV.apps(true) : [];
    const groups = new Map();
    const put = (k, a) => { if (!groups.has(k)) groups.set(k, []); groups.get(k).push({ pkg: a.pkg, label: a.label }); };
    for (const a of all) {
      const p = a.pkg;
      if (/kakao\.talk|messag|mms|telegram|discord|line|whatsapp|instagram|facebook|twitter|x\.android/.test(p) || a.cat === 4) put('소셜·메신저', a);
      else if (a.cat in CATS) put(CATS[a.cat], a);
      else if (/^com\.(samsung|sec)\./.test(p)) put('Samsung', a);
      else if (/^com\.google\./.test(p)) put('Google', a);
      else if (/bank|pay|wallet|toss|kbstar|shinhan|woori|hana|nh|kakaobank|card/.test(p)) put('금융', a);
      else if (/shop|coupang|11st|gmarket|baemin|yogiyo|musinsa|auction/.test(p)) put('쇼핑·배달', a);
      else put('', a);
    }
    const out = [];
    for (const [k, list] of groups) {
      if (!k || list.length < 2) list.forEach((a) => out.push(a));
      else out.unshift({ folder: k, items: list.sort((x, y) => x.label.localeCompare(y.label, 'ko')) });
    }
    const loose = out.filter((a) => !a.folder).sort((x, y) => nameOf(x).localeCompare(nameOf(y), 'ko'));
    const prev = JSON.parse(JSON.stringify(data)); store.set('homePrev', prev);
    const res = [...out.filter((a) => a.folder), ...loose, ...(w === 'a' ? INTERNAL.map((x) => ({ ...x })) : [])];
    data.np = data.np || {};
    if (w === 'a') { data.drawer = res; data.np.a = 1; } else { data.items = [...res, { ...INTERNAL[0] }]; data.np.h = 1; }
    syncDrawer(); save(); render(); if (!drawerEl.hidden) renderDrawer();
    return out.filter((a) => a.folder).length;
  }
  function importSheet() {
    const sync = S().sync;
    const body = ctx.sheet('기존 홈 앱에서 가져오기', `
      <p class="cr-note">One UI 홈 등 원래 쓰던 홈 앱의 <b>페이지 · 폴더 · 독 · 앱스 화면</b> 배치를 그대로 불러와요. 기기·버전에 따라 그 홈 앱이 읽기를 막아 두었을 수 있어요.</p>
      <div class="pick-bar" style="justify-content:flex-start;flex-wrap:wrap">
        <button class="btn y" id="im-all">홈 + 앱 서랍 불러오기</button><button class="btn" id="im-home">홈 화면만</button><button class="btn" id="im-drawer">앱 서랍만</button>
      </div>
      <div class="row"><span>자동 동기화 (원래 홈 앱에서 바꾸면 이 런처도 따라 바꿈)</span><input id="im-sync" type="checkbox"${sync ? ' checked' : ''}></div>
      <h4>불러올 수 없을 때</h4>
      <p class="cr-note">앱 종류(게임 · 메신저 · 사진 · 동영상 · 음악 · 업무 · 금융 · 쇼핑 · Samsung · Google …)로 폴더를 자동으로 만들어요.</p>
      <div class="pick-bar" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn" id="im-cat-a">앱 서랍 자동 정리</button><button class="btn" id="im-cat-h">홈 화면 자동 정리</button><button class="btn" id="im-undo">되돌리기</button></div>
      <p class="cr-note" id="im-msg"></p>`);
    const msg = (t) => { body.querySelector('#im-msg').innerHTML = t; };
    const run = (o) => {
      if (!isNative) return msg('앱(APK)에서만 할 수 있어요.');
      const res = readLauncher();
      const got = applyLauncher(res, o);
      if (got) {
        store.set('syncHash', layoutHash(res));
        audio.play('SE_Confirm_02');
        msg(`${esc(res.source || '홈 앱')}에서 불러왔어요 — 홈 ${got.home} · 독 ${got.dock} · 앱 서랍 ${got.drawer} · 폴더 ${got.folders}개`);
        bubble('원래 홈 화면 배치를 불러왔어요!');
      } else {
        const why = (res.tried || []).filter((t) => t.result !== '없음').map((t) => `${esc(t.name)}: ${esc(t.result || '읽기 실패')}`).join(' · ') || '읽을 수 있는 홈 앱이 없어요';
        msg(`불러오지 못했어요 (${why}). 이 기기의 홈 앱이 다른 앱에 배치를 보여 주지 않는 것 같아요. 아래 자동 정리를 써 보세요.`);
      }
    };
    body.querySelector('#im-all').addEventListener('click', () => run({ home: true, drawer: true }));
    body.querySelector('#im-home').addEventListener('click', () => run({ home: true, drawer: false }));
    body.querySelector('#im-drawer').addEventListener('click', () => run({ home: false, drawer: true }));
    body.querySelector('#im-sync').addEventListener('change', (e) => {
      setS('sync', e.target.checked);
      if (e.target.checked) { const res = readLauncher(); if (!(res.favorites || []).length) { msg('이 기기에서는 원래 홈 앱의 배치를 읽을 수 없어서 동기화가 동작하지 않아요.'); } else store.set('syncHash', layoutHash(res)); }
    });
    body.querySelector('#im-cat-a').addEventListener('click', () => { const n = autoFolders('a'); audio.play('SE_Confirm_02'); msg(`앱 서랍을 폴더 ${n}개로 정리했어요.`); });
    body.querySelector('#im-cat-h').addEventListener('click', () => { if (locked()) return; const n = autoFolders('h'); audio.play('SE_Confirm_02'); msg(`홈 화면을 폴더 ${n}개로 정리했어요.`); });
    body.querySelector('#im-undo').addEventListener('click', () => {
      const p = store.get('homePrev', null); if (!p) return msg('되돌릴 배치가 없어요.');
      store.set('homePrev', JSON.parse(JSON.stringify(data))); data = p; save(); render(); if (!drawerEl.hidden) renderDrawer(); msg('이전 배치로 되돌렸어요.');
    });
  }
  /** 자동 동기화: 이 런처로 돌아올 때 원래 홈 앱의 배치가 바뀌었으면 따라 바꾼다 */
  function syncCheck() {
    if (!isNative || !S().sync || !data) return;
    const res = readLauncher(); if (!(res.favorites || []).length) return;
    const h = layoutHash(res);
    if (h === store.get('syncHash', '')) return;
    store.set('syncHash', h);
    if (applyLauncher(res, { home: true, drawer: true })) bubble(`${res.source || '홈 앱'}에서 바뀐 배치를 맞춰 놓았어요!`);
  }
  /** 아이콘 편집: 모든 앱을 한 화면에서 보고 하나씩 바꾼다 (테마파크 '개별 아이콘 변경'처럼) */
  function iconEditor() {
    syncDrawer();                                         // 설치된 앱 전부
    const all = flat(data.drawer).filter((a) => (a.pkg || a.url || a.int) && isIn(a))
      .sort((x, y) => nameOf(x).localeCompare(nameOf(y), 'ko'));
    const custom = store.get('icons', {});
    const n = all.filter((a) => custom[keyOf(a)]).length;
    const body = ctx.sheet('아이콘 편집', `<p class="cr-note">앱을 누르면 아이콘을 바꿔요 (갤러리 이미지 · UI 아이콘). 바꾼 앱 ${n}개.</p>
      <div class="pick-list">${all.map((a, i) => `<button class="pick${custom[keyOf(a)] ? ' on' : ''}" data-i="${i}"><span class="ic">${iconImg(a)}</span><b>${esc(nameOf(a))}</b></button>`).join('')}</div>
      <div class="pick-bar"><button class="btn" id="ie-auto">추천 아이콘 자동 적용</button><button class="btn" id="ie-reset">모두 원래대로</button><button class="btn y" id="ie-done">완료</button></div>`);
    body.querySelector('#ie-auto').addEventListener('click', async () => {
      // 아직 바꾸지 않은 앱 중 추천 아이콘이 있는 앱만
      const m = store.get('icons', {}); let n = 0;
      for (const a of all) { if (m[keyOf(a)]) continue; const s2 = await suggest(NV, a); if (s2.length) { m[keyOf(a)] = s2[0].v; n++; } }
      store.set('icons', m); audio.play('SE_Confirm_02'); render(); iconEditor(); bubble(n ? `${n}개 앱에 추천 아이콘을 입혔어요!` : '바꿀 수 있는 앱이 없었어요.');
    });
    body.querySelector('.pick-list').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { audio.play('UI_Button_Touch'); iconPicker(all[+b.dataset.i], iconEditor); } });
    body.querySelector('#ie-done').addEventListener('click', () => { audio.play('UI_Button_Touch'); ctx.closeSheet(); });
    body.querySelector('#ie-reset').addEventListener('click', () => { store.set('icons', {}); audio.play('SE_Confirm_02'); render(); iconEditor(); });
  }
  function hiddenApps() {
    const all = isNative ? NV.apps(true).map((a) => ({ pkg: a.pkg, label: a.label })) : [];
    const h = new Set(S().hidden);
    const body = ctx.sheet('숨긴 앱', `<p class="cr-note">체크한 앱은 앱 서랍에서 보이지 않아요 (검색하면 나와요).</p><div class="pick-list">${all.map((a, i) =>
      `<label class="pick"><input type="checkbox" data-i="${i}"${h.has(a.pkg) ? ' checked' : ''}><span class="ic">${iconImg(a)}</span><b>${esc(a.label)}</b></label>`).join('')}</div>
      <div class="pick-bar"><button class="btn y" id="pick-ok">완료</button></div>`);
    body.querySelector('#pick-ok').addEventListener('click', () => {
      setS('hidden', [...body.querySelectorAll('input:checked')].map((x) => all[+x.dataset.i].pkg));
      ctx.closeSheet(); audio.play('SE_Confirm_02'); renderDrawer();
    });
  }

  // ───────── 편집 모드 (빈 곳 길게 누르기) — One UI 처럼 아래쪽에 배경화면 · 아이콘 · 위젯 · 설정 ─────────
  function editMode(on) {
    root.classList.toggle('edit', on);
    editEl.hidden = !on;
    if (on) { audio.play('UI_Button_Touch'); syncEdit(); }
  }
  function syncEdit() {
    const s = S();
    editEl.querySelector('[data-e=lock] small').textContent = s.lock ? '잠김' : '풀림';
  }
  editEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-e]'); if (!b) return;
    audio.play('UI_Button_Touch');
    const k = b.dataset.e;
    if (k === 'done') return editMode(false);
    if (k === 'wall') { editMode(false); return ctx.cycleWallpaper(); }
    if (k === 'icon') { store.set('themeIcons', !store.get('themeIcons', false)); render(); bubble(store.get('themeIcons', false) ? 'UI 아이콘 테마를 켰어요!' : '원래 앱 아이콘으로 되돌렸어요!'); return; }
    if (k === 'widget') return widgetPicker();
    if (k === 'addpage') return addPage('h');
    if (k === 'delpage') return delPage('h');
    if (k === 'lock') { setS('lock', !S().lock); syncEdit(); render(); return bubble(S().lock ? '홈 화면 배치를 잠갔어요.' : '홈 화면 배치 잠금을 풀었어요.'); }
    if (k === 'folder') { if (locked()) return; data.items.push({ folder: '새 폴더', items: [] }); save(); render(); return; }
    if (k === 'set') { editMode(false); return openSettings('launcher'); }
  });

  // ───────── 누르기 · 길게 누르기 · 끌기 · 밀기 ─────────
  let press = null;
  const down = (e) => {
    if (e.button > 0) return;
    if (press) { if (e.pointerId !== press.id && press.drag) return; clearTimeout(press.timer); press = null; }   // 놓친 손 떼기가 남아 있으면 버린다
    hideMenu();
    const btn = e.target.closest('.hi');
    const inDrawer = !!e.target.closest('#h-drawer'), inFolder = !!e.target.closest('#folder');
    const pager = inFolder || e.target.closest('#d-results, .d-top, #h-edit') ? null
      : inDrawer ? dPages : e.target.closest('#h-dock, #h-work, #h-batime, #h-all') ? null : pagesEl;
    // 세로로 스크롤되는 목록 (앱이 많은 폴더 · 서랍 검색 결과) — 아이콘 위에서 밀어도 스크롤
    const vs = inFolder ? folderEl.querySelector('.fgrid') : e.target.closest('#d-results');
    press = { btn, x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, drag: null, long: false, inDrawer, inFolder, pager, sl: pager ? pager.scrollLeft : 0, mode: null, vs, st: vs ? vs.scrollTop : 0 };
    press.timer = setTimeout(() => {
      if (!press || press.mode) return;
      press.long = true;
      if (navigator.vibrate) navigator.vibrate(12);
      if (press.btn) press.btn.classList.add('lifted');
    }, LONG);
  };
  const move = (e) => {
    if (!press || e.pointerId !== press.id) return;
    const dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (!press.long) {
      if (!press.mode && Math.hypot(dx, dy) > MOVE) { clearTimeout(press.timer); press.mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'; }
      if (press.mode === 'h' && press.pager) press.pager.scrollLeft = press.sl - dx;
      if (press.mode === 'v' && press.vs) press.vs.scrollTop = press.st - dy;
      return;
    }
    if (!press.btn || press.btn.dataset.add || press.btn.dataset.fadd || press.btn.dataset.w === 's') return;
    if (!press.drag && Math.hypot(dx, dy) > MOVE) {
      const a = itemAt(press.btn);
      if (S().lock && press.btn.dataset.w !== 'a' && !(press.btn.dataset.w === 'f' && openFolder.owner === data.drawer)) { press.btn.classList.remove('lifted'); press.long = false; press.mode = 'x'; return locked(); }
      if (a && a.int && press.btn.dataset.w === 'f') return;
      startDrag(e);
    }
    if (press.drag) moveDrag(e);
  };
  const end = (e) => {
    if (!press || e.pointerId !== press.id) return;
    clearTimeout(press.timer);
    const p = press; press = null;
    if (p.btn) p.btn.classList.remove('lifted');
    if (p.drag) return endDrag(e, p);
    const dx = e.clientX - p.x, dy = e.clientY - p.y, dt = performance.now() - p.t;
    if (p.mode === 'h') { if (p.pager) snap(p.pager, dx, dt); return; }
    if (p.mode === 'v') {
      if (p.vs && p.vs.scrollHeight > p.vs.clientHeight + 2) {                 // 스크롤만 하고 끝 (관성 조금)
        const v = dy / Math.max(1, dt); if (Math.abs(v) > 0.4) p.vs.scrollBy({ top: -v * 260, behavior: 'smooth' }); return;
      }
      if (p.inFolder || dt > 900 || Math.abs(dy) < 50) return;
      if (dy < 0 && !p.inDrawer && S().swipeUp && !root.classList.contains('edit')) { audio.play('UI_Button_Touch'); return openAppDrawer(); }
      if (dy > 0 && p.inDrawer && !e.target.closest('#d-results')) { audio.play('UI_Button_Back'); return closeAppDrawer(); }
      if (dy > 0 && !p.inDrawer && S().swipeDown && isNative) return NV.N.notifications();
      return;
    }
    if (p.mode) return;
    if (p.long || p.btn) eatClick = true;        // 이 터치가 연 창(폴더·메뉴)에 '클릭'이 다시 떨어지지 않게
    if (p.long) {
      if (p.btn) return p.btn.dataset.add || p.btn.dataset.fadd ? null : itemMenu(p.btn, e.clientX, e.clientY);
      if (p.inDrawer) return e.target.closest('.d-top') ? null : drawerMenu(e.clientX, e.clientY);
      if (p.inFolder) return;
      return !e.target.closest('.hw, #h-work, #h-edit') && editMode(true);
    }
    if (p.btn && p.btn.dataset.fadd) { audio.play('UI_Button_Touch'); return folderAdd(); }
    if (p.btn) return open(p.btn);
    if (root.classList.contains('edit') && !e.target.closest('#h-edit')) return editMode(false);
    if (!p.inDrawer && !p.inFolder && !e.target.closest('#h-dock, #h-all, #h-dots, #h-work, #h-batime, #h-edit')) ctx.tapEmpty?.(e);
  };
  const cancel = () => {
    if (!press) return;
    clearTimeout(press.timer);
    if (press.drag) { press.drag.ghost.remove(); root.classList.remove('editing'); render(); }
    else if (press.mode === 'h' && press.pager) snap(press.pager, 0, 1000);
    press = null;
  };
  let eatClick = false;
  document.addEventListener('touchend', (e) => { if (eatClick) { eatClick = false; if (e.cancelable) e.preventDefault(); } }, { passive: false, capture: true });
  // 누르기는 홈 · 폴더 위에서 시작하고, 움직임 · 손 떼기는 문서 전체에서 받는다.
  // (누르는 사이 화면이 다시 그려져 누른 아이콘이 바뀌어도 손 떼기를 놓치지 않게 — 놓치면 다음 터치가 막혔다)
  for (const el of [root, folderEl]) el.addEventListener('pointerdown', down);
  document.addEventListener('pointermove', move, true);
  document.addEventListener('pointerup', end, true);
  document.addEventListener('pointercancel', cancel, true);
  addEventListener('blur', () => { if (press && !press.drag) { clearTimeout(press.timer); press = null; } });

  function startDrag(e) {
    const btn = press.btn, r = btn.getBoundingClientRect();
    const ghost = btn.cloneNode(true); ghost.className = 'hi ghost'; ghost.removeAttribute('style');
    Object.assign(ghost.style, { width: r.width + 'px', height: r.height + 'px' });
    document.body.appendChild(ghost);
    btn.classList.add('dragging');
    press.drag = { ghost, ox: e.clientX - r.left, oy: e.clientY - r.top, from: btn.dataset.w, i: +btn.dataset.i, edgeT: 0, copy: false, owner: openFolder.owner };
    try { root.setPointerCapture(e.pointerId); } catch (_) {}     // 폴더 창을 닫아도 끌기가 끊기지 않게
    if (btn.dataset.w === 'f') folderEl.hidden = true;
    root.classList.add('editing');
    root.classList.toggle('from-home', press.drag.from !== 'a' && !(press.drag.from === 'f' && press.drag.owner === data.drawer));
    addExtraPage();
  }
  // 끌고 있는 동안 맨 뒤에 빈 페이지를 하나 더 둔다 (새 페이지로 옮기기)
  function addExtraPage() {
    document.querySelectorAll('.hp.extra').forEach((x) => x.remove());
    const [el, w] = drawerEl.hidden || press?.drag?.copy ? [pagesEl, 'h'] : [dPages, 'a'];
    const n = el.querySelectorAll('.hp').length, { cols, rows } = G[w];
    el.insertAdjacentHTML('beforeend', `<section class="hp extra" data-w="${w}" data-p="${n}" style="--cols:${cols};--rows:${rows}"></section>`);
  }
  function moveDrag(e) {
    const d = press.drag;
    d.ghost.style.transform = `translate(${e.clientX - d.ox}px, ${e.clientY - d.oy}px) scale(1.08)`;
    d.ghost.style.visibility = 'hidden';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    d.ghost.style.visibility = '';
    // 서랍 위쪽 '홈 화면에 놓기' 띠에 대면 서랍이 닫히고 홈 화면에서 계속 끈다 (복사)
    if (d.from === 'a' || (d.from === 'f' && d.owner === data.drawer)) {
      const hot = under && under.closest('#d-tohome');
      $('#d-tohome').classList.toggle('hot', !!hot);
      if (hot && !d.copy) {
        if (S().lock) { $('#d-tohome').classList.remove('hot'); } else {
          d.copy = true; drawerEl.hidden = true; root.classList.add('from-home'); addExtraPage(); if (navigator.vibrate) navigator.vibrate(10);
        }
      }
    }
    document.querySelectorAll('.hi.target, #h-zones .hot').forEach((x) => x.classList.remove('target', 'hot'));
    const z = under && under.closest('#h-zones [data-z]'); if (z) z.classList.add('hot');
    const t = under && under.closest('.hi:not(.dragging):not(.ghost):not(.add):not(.fadd)');
    if (t && t.dataset.w !== 's') t.classList.add('target');
    const el = drawerEl.hidden ? pagesEl : dPages;
    const edge = e.clientX < 30 ? -1 : e.clientX > innerWidth - 30 ? 1 : 0;
    if (edge && performance.now() - d.edgeT > 700) { d.edgeT = performance.now(); el.scrollBy({ left: edge * el.clientWidth, behavior: 'smooth' }); }
  }
  /** 격자 페이지(sec) 위 포인터 → 칸 [p, c, r] */
  function cellAt(sec, x, y) {
    const w = sec.dataset.w, { cols, rows } = G[w], r = sec.getBoundingClientRect();
    const c = Math.max(0, Math.min(cols - 1, Math.floor((x - r.left) / (r.width / cols))));
    const rr = Math.max(0, Math.min(rows - 1, Math.floor((y - r.top) / (r.height / rows))));
    return [+sec.dataset.p, c, rr];
  }
  function endDrag(e, p) {
    const d = p.drag; d.ghost.remove(); root.classList.remove('editing', 'from-home');
    try { root.releasePointerCapture(e.pointerId); } catch (_) {}
    $('#d-tohome').classList.remove('hot');
    document.querySelectorAll('.hi.target, #h-zones .hot').forEach((x) => x.classList.remove('target', 'hot'));
    const src = d.from === 'f' ? (openFolder.cur ? openFolder.cur.items : []) : list(d.from);
    const srcFolder = d.from === 'f' ? openFolder.cur : null;
    let item = src[d.i];
    if (!item) { folderEl.hidden = true; return render(); }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const zone = under && under.closest('#h-zones [data-z]');
    const t = under && under.closest('.hi:not(.dragging):not(.ghost):not(.add):not(.fadd)');
    const tw = t && t.dataset.w;
    const tgt = t && tw !== 's' && tw !== 'f' ? list(tw)[+t.dataset.i] : null;   // 놓을 대상 (옮기기 전에 잡아 둔다)
    const sec = under && under.closest('.hp');
    const inDock = under && under.closest('#h-dock');
    if (d.copy) item = bare(item.folder ? { folder: item.folder, color: item.color, items: item.items.map(bare) } : item);
    else src.splice(d.i, 1);
    const putBack = () => { if (!d.copy) src.splice(d.i, 0, item); };
    let done = false;
    if (zone) {
      const z = zone.dataset.z;
      if (z === 'remove') done = true;                                                    // 홈에서 제거 (서랍에서 끌어온 복사본이면 그냥 취소)
      else { putBack(); done = true; if (item.pkg && isNative) (z === 'uninstall' ? NV.N.uninstall(item.pkg) : NV.N.appInfo(item.pkg)); }
    } else if (tgt && tgt !== item && !item.widget && !tgt.widget) {
      const L = list(tw), ti = L.indexOf(tgt);
      if (!item.folder && tgt.folder) { tgt.items.push(bare(item)); done = true; }
      else if (!item.folder && (tw === 'h' || tw === 'a')) { L.splice(ti, 1, { folder: '폴더', items: [bare(tgt), bare(item)], pos: tgt.pos }); done = true; }
      else if (!item.folder && tw === 'd') { if (L.length < maxDock() || d.from === 'd') { L.splice(ti, 0, bare(item)); done = true; } }
      else if (item.folder && (tw === 'h' || tw === 'a') && L === src) { const tp = tgt.pos; tgt.pos = item.pos; L.push({ ...item, pos: tp }); done = true; }
    } else if (inDock && !item.folder && !item.widget && (data.dock.length < maxDock() || d.from === 'd')) { data.dock.push(bare(item)); done = true; }
    else if (sec) {
      const w = sec.dataset.w, L = list(w), pos = cellAt(sec, e.clientX, e.clientY);
      const busy = L.some((o) => o !== item && (disp.get(o) || o.pos) && String(disp.get(o) || o.pos) === String(pos));
      if (item.widget) {                                                                 // 위젯: 홈에서만, 칸이 다 비어 있을 때
        const [sw, sh] = spanOf(item), { cols, rows } = G[w], per = cols * rows;
        const occ = new Set(); L.forEach((o) => { if (o === item || !isIn(o)) return; const q = disp.get(o) || o.pos; if (!q) return; const [a2, b2] = spanOf(o); for (let y = 0; y < b2; y++) for (let x = 0; x < a2; x++) occ.add(q[0] * per + (q[2] + y) * cols + q[1] + x); });
        const c = Math.min(pos[1], cols - sw), r = Math.min(pos[2], rows - sh); let free = w === 'h' && c >= 0 && r >= 0;
        for (let y = 0; free && y < sh; y++) for (let x = 0; x < sw; x++) if (occ.has(pos[0] * per + (r + y) * cols + c + x)) free = false;
        if (free) { L.push({ ...item, pos: [pos[0], c, r] }); done = true; }
      } else if (w === 'a' ? d.from === 'a' || (d.from === 'f' && d.owner === data.drawer) : !(d.from === 'a' && !d.copy)) { L.push({ ...item, pos: busy ? null : pos }); done = true; }
    }
    if (!done) putBack();
    if (srcFolder && !d.copy) tidyFolder(srcFolder, d.owner || data.items);
    folderEl.hidden = true; openFolder.cur = null;
    document.querySelectorAll('.hp.extra').forEach((x) => x.remove());
    if (d.copy && done && !zone) bubble(`${nameOf(item)}을(를) 홈 화면에 놓았어요!`);
    save(); render();
  }

  $('#h-all').addEventListener('click', () => { audio.play('UI_Button_Touch'); openAppDrawer(); });
  $('#h-work').addEventListener('click', () => ctx.openWork());

  // ───────── 배지 · 앱 변화 ─────────
  const refreshBadges = (m) => { badgeMap = m || NV.badges(); if (root.offsetParent) render(); };
  if (isNative) { NV.on('badges', refreshBadges); setTimeout(() => { badgeMap = NV.badges(); }, 500); }

  // ───────── 위젯 ─────────
  let lastBat = null, memoT = 0;
  /** 바뀔 때만 쓴다 — 같은 글자를 매초 다시 쓰면 화면 배치를 다시 계산해서 캐릭터 움직임이 1초마다 멈칫했다 */
  const setT = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };
  const setP = (el, k, v) => { if (el && el.style.getPropertyValue(k) !== String(v)) el.style.setProperty(k, v); };
  function widgets(b) {
    if (b && b.level >= 0) lastBat = b; else b = lastBat || (isNative ? NV.battery() : null);
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    pagesEl.querySelectorAll('.wg-clock').forEach((w) => { setT(w.querySelector('.wg-t'), `${p(d.getHours())}:${p(d.getMinutes())}`); setT(w.querySelector('.wg-d'), `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`); });
    pagesEl.querySelectorAll('.wg-battery').forEach((w) => { if (!b || !(b.level >= 0)) return; setT(w.querySelector('.wg-b'), b.level + '%'); setP(w, '--p', b.level / 100); w.classList.toggle('charging', !!b.charging); });
    const memos = pagesEl.querySelectorAll('.wg-memo .wg-m');
    if (memos.length && (Date.now() - memoT > 600000 || !memos[0].textContent)) { memoT = Date.now(); const t = ctx.memo ? ctx.memo() : ''; memos.forEach((m) => { m.textContent = t; }); }
    setT($('#h-time'), `${p(d.getHours())}:${p(d.getMinutes())}`);
    setT($('#h-date'), `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`);
    const h12 = d.getHours() % 12 || 12;
    setT($('#h-batime span'), `${d.getHours() < 12 ? 'AM' : 'PM'} ${h12}:${p(d.getMinutes())}`);
    if (b && b.level >= 0) {
      setT($('#h-bat'), String(b.level));
      setP($('#w-bat'), '--p', b.level / 100);
      $('#w-bat').classList.toggle('charging', !!b.charging);
      $('#w-bat').classList.toggle('low', b.level <= 15);
    }
  }

  return {
    render, widgets, closeFolder,
    openDrawer: openAppDrawer, closeDrawer: closeAppDrawer,
    get drawerOpen() { return !drawerEl.hidden; },
    settings: S, set: (k, v) => { setS(k, v); render(); },
    hiddenApps, importSheet, syncCheck, iconEditor,
    setIntBadge(k, n) { if ((intBadge[k] || 0) === n) return; intBadge[k] = n; if (root.offsetParent) render(); },
    reset() { data = { ...defaults(), drawer: data ? data.drawer : [] }; save(); render(); },
    addApp(a) { if (locked()) return; if (!data) data = defaults(); if (!flat(data.items).some((x) => keyOf(x) === keyOf(a))) data.items.push(a); save(); render(); },
    /** 뒤로 가기: 열린 것부터 닫는다. 닫은 게 있으면 true */
    back() {
      if (!menuEl.hidden) { hideMenu(); return true; }
      if (root.classList.contains('edit')) { editMode(false); return true; }
      return closeFolder() || closeAppDrawer();
    },
    /** 앱 설치 · 삭제: 지워진 앱 정리, 새 앱은 서랍(+설정 시 홈)에 */
    prune(ev) {
      if (!isNative || !data) return;
      if (ev && ev.kind === 'removed' && ev.pkg) forget(ev.pkg);               // 정말 삭제된 앱만 정리
      // 'updating'(업데이트 중 잠깐 빠짐)이면 아무것도 지우지 않는다 — 배치 · 폴더 그대로
      if (!ev || ev.kind !== 'updating') { newApps(); syncDrawer(); }
      else refreshInstalled();
      save(); render();
    },
  };
}
