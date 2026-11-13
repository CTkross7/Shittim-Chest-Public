// 아이콘 라이브러리 — 블아 스타일 앱 아이콘(assets/icons/ba, Simple Icons CC0 로고로 직접 만든 것) + UI 아이콘(assets/ui, 자체 제작) + 갤러리 그림.
// 선택 값(store 'icons' 에 저장): 'ba:<이름>' | 'ui:<이름>' | dataURL(갤러리)

export const KINDS = [
  ['all', '전체'], ['ba', '블아 스타일 앱'], ['ui', 'UI 아이콘'],
];
export const TAGS = [
  ['game', '게임'], ['sns', 'SNS · 메신저'], ['media', '음악 · 영상'], ['photo', '사진'], ['shop', '쇼핑 · 금융'],
  ['travel', '지도 · 교통'], ['work', '문서 · 생산성'], ['tool', '도구 · 유틸'], ['food', '음식'], ['life', '생활'],
  ['health', '건강 · 운동'], ['nature', '날씨 · 자연'],
];
// UI 아이콘의 용도
const UI_TAGS = {
  chat: ['sns'], mail: ['sns'], mail2: ['sns'], notice: ['sns', 'work'], notice2: ['sns'], schedule: ['work', 'tool'], mission: ['tool', 'work'],
  codex: ['tool'], settings: ['tool'], gear: ['tool'], tablet: ['tool'], gallery: ['photo'], search: ['tool'], notes: ['work'], task: ['work'], check: ['work', 'tool'],
  book: ['work'], shittim: ['tool', 'work'], shop: ['shop'], store24: ['shop'], bag: ['shop'], wallet: ['shop'], tag: ['shop'], gift: ['shop'],
  cafe: ['food', 'life'], house: ['life'], office: ['work'], tower: ['travel'], student: ['sns'], stars: ['game'], cloud: ['nature'],
  shield: ['tool'], sword: ['game'], question: ['tool'], menu: ['tool'],
};

let LIB = null;
async function load(NV) {
  if (LIB) return LIB;
  let ba = [];
  try { ba = await (await fetch('data/ba-icons.json')).json(); } catch (_) { /* 없음 */ }
  LIB = [
    ...ba.map((x) => ({ v: 'ba:' + x.i, src: `assets/icons/ba/${x.i}.webp`, n: x.n, k: 'ba', t: x.t || [], m: x.m || '' })),
    ...NV.UI_ICONS.map((n) => ({ v: 'ui:' + n, src: `assets/ui/${n}.svg`, n, k: 'ui', t: UI_TAGS[n] || [] })),
  ];
  return LIB;
}
/** 이 앱에 맞는 블아 스타일 아이콘 (패키지 · 이름으로 찾음) */
export async function suggest(NV, a) {
  const all = await load(NV), s = `${a.pkg || a.url || ''} ${a.label || a.name || ''}`;
  return all.filter((x) => x.m && (() => { try { return new RegExp(x.m, 'i').test(s); } catch (_) { return false; } })());
}
/** 저장된 값 → 그림 주소 */
export function srcOf(v) {
  if (!v) return null;
  if (v.startsWith('ui:')) return `assets/ui/${v.slice(3)}.svg`;
  if (v.startsWith('lib:')) return `assets/icons/lib/${v.slice(4)}.webp`;
  if (v.startsWith('ba:')) return `assets/icons/ba/${v.slice(3)}.webp`;
  return v;   // dataURL
}
/** 앱 이름 · 패키지로 용도 추측 (처음 열 때 그 용도로 걸러 보여 준다) */
export function guessTag(a) {
  const s = `${a.pkg || a.url || ''} ${a.label || a.name || ''}`.toLowerCase();
  const R = [
    ['sns', /kakao\.talk|message|messag|mms|telegram|discord|line|whatsapp|instagram|facebook|twitter|threads|x\.android|band|mail|gmail|카카오톡|메시지|디스코드/],
    ['media', /youtube|netflix|music|spotify|melon|genie|flo|podcast|video|tving|wavve|twitch|soundcloud|유튜브|음악|넷플릭스/],
    ['photo', /camera|gallery|photo|snow|b612|카메라|갤러리|사진/],
    ['game', /game|play\.games|steam|nexon|bluearchive|cookie|devsisters|hoyoverse|genshin|supercell|게임|블루 아카이브/],
    ['shop', /shop|store|coupang|11st|gmarket|baemin|yogiyo|musinsa|bank|pay|wallet|toss|card|쇼핑|은행|페이|스토어/],
    ['travel', /maps|map|navi|tmap|kakaomap|nmap|subway|bus|taxi|uber|지도|버스|지하철|택시/],
    ['work', /docs|office|word|excel|sheets|slides|notion|keep|notes|memo|calendar|drive|files|documentsui|myfiles|문서|메모|캘린더|파일/],
    ['tool', /settings|calculator|clock|alarm|vpn|proton|browser|chrome|sbrowser|smartthings|설정|계산기|시계|브라우저/],
    ['health', /health|fit|samsung\.android\.app\.health|운동|건강/],
    ['food', /food|delivery|coffee|starbucks|배달|커피/],
    ['nature', /weather|날씨/],
  ];
  for (const [t, re] of R) if (re.test(s)) return t;
  return 'all';
}

/**
 * 아이콘 고르기 화면 — 위쪽 드롭다운(아이콘 그림이 보이는 목록)에서 종류 · 용도 · 검색으로 걸러 고른다.
 * opts: { sheet, closeSheet, esc, audio, NV, title, app, current, onPick(v|null) }
 */
export async function openIconPicker(o) {
  const { esc } = o;
  const all = await load(o.NV);
  const st = { k: 'all', t: guessTag(o.app || {}), q: '', n: 0, sel: o.current || null };
  const tagName = (t) => (TAGS.find((x) => x[0] === t) || [, '전체'])[1];
  const body = o.sheet(o.title, `
    <div class="il-top">
      <span class="il-cur">${o.currentHtml || ''}</span>
      <div class="il-dd">
        <button class="il-btn" type="button"><span class="il-pv"></span><b>아이콘 선택</b><i>▾</i></button>
        <div class="il-panel" hidden>
          <input class="il-q" type="search" placeholder="이름으로 찾기 (영문 · 예: phone, cat, halo)" autocomplete="off">
          <div class="il-chips il-k">${o.kinds !== false ? KINDS.map(([k, n]) => `<button data-k="${k}">${n}</button>`).join('') : ''}</div>
          <div class="il-chips il-t"><button data-t="all">모든 용도</button>${TAGS.map(([t, n]) => `<button data-t="${t}">${n}</button>`).join('')}</div>
          <div class="il-sug" hidden><b>추천</b><div class="il-grid il-sg"></div></div>
          <p class="il-count"></p>
          <div class="il-grid"></div>
        </div>
      </div>
    </div>
    <div class="pick-bar"><label class="btn">갤러리에서 고르기<input type="file" accept="image/*" hidden class="il-file"></label><button class="btn il-reset">원래 아이콘</button><button class="btn y il-ok">적용</button></div>`);
  const $ = (s) => body.querySelector(s);
  const panel = $('.il-panel'), grid = $('.il-grid:not(.il-sg)');
  const showSel = () => { const src = o.srcOf(st.sel); $('.il-pv').innerHTML = src ? `<img src="${esc(src)}" alt="">` : ''; $('.il-btn b').textContent = st.sel ? (all.find((x) => x.v === st.sel)?.n || '갤러리 이미지') : '아이콘 선택'; };
  const list = () => {
    const q = st.q.trim().toLowerCase();
    return all.filter((x) => (st.k === 'all' || x.k === st.k) && (st.t === 'all' || x.t.includes(st.t)) && (!q || x.n.toLowerCase().includes(q) || (x.m || '').toLowerCase().includes(q)));
  };
  let cur = [];
  const page = () => {
    const more = cur.slice(st.n, st.n + 120); st.n += more.length;
    grid.insertAdjacentHTML('beforeend', more.map((x) => `<button class="il-it${x.v === st.sel ? ' on' : ''}" data-v="${esc(x.v)}" title="${esc(x.n)}"><img src="${esc(x.src)}" alt="" loading="lazy" decoding="async"><small>${esc(x.n)}</small></button>`).join(''));
  };
  const draw = () => {
    cur = list(); st.n = 0; grid.innerHTML = ''; grid.scrollTop = 0; page();
    $('.il-count').textContent = `${cur.length}개${st.t !== 'all' ? ' · ' + tagName(st.t) : ''}${cur.length === 0 && st.t !== 'all' ? ' — 용도를 \'모든 용도\'로 바꿔 보세요' : ''}`;
    body.querySelectorAll('.il-k button').forEach((b) => b.classList.toggle('on', b.dataset.k === st.k));
    body.querySelectorAll('.il-t button').forEach((b) => b.classList.toggle('on', b.dataset.t === st.t));
  };
  grid.addEventListener('scroll', () => { if (grid.scrollTop + grid.clientHeight > grid.scrollHeight - 300 && st.n < cur.length) page(); }, { passive: true });
  $('.il-btn').addEventListener('click', () => { o.audio.play('UI_Button_Touch'); panel.hidden = !panel.hidden; $('.il-dd').classList.toggle('open', !panel.hidden); if (!panel.hidden && !grid.childElementCount) draw(); });
  $('.il-k').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; o.audio.play('UI_Button_Touch'); st.k = b.dataset.k; draw(); });
  $('.il-t').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; o.audio.play('UI_Button_Touch'); st.t = b.dataset.t; draw(); });
  let qT = 0; $('.il-q').addEventListener('input', (e) => { st.q = e.target.value; clearTimeout(qT); qT = setTimeout(draw, 150); });
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.il-it'); if (!b) return;
    o.audio.play('UI_Button_Touch'); st.sel = b.dataset.v;
    grid.querySelectorAll('.il-it.on').forEach((x) => x.classList.remove('on')); b.classList.add('on');
    showSel(); panel.hidden = true; $('.il-dd').classList.remove('open');
  });
  $('.il-ok').addEventListener('click', () => { o.onPick(st.sel); });
  $('.il-reset').addEventListener('click', () => { o.onPick(null); });
  $('.il-file').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 192;
      const g = c.getContext('2d'), s = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 192, 192);
      URL.revokeObjectURL(img.src); const w = c.toDataURL('image/webp', 0.9);
      o.onPick(w.startsWith('data:image/webp') ? w : c.toDataURL('image/png'));
    };
    img.src = URL.createObjectURL(f);
  });
  // 이 앱에 맞는 추천 아이콘을 맨 위에
  const sug = await suggest(o.NV, o.app || {});
  if (sug.length) {
    $('.il-sug').hidden = false;
    $('.il-sg').innerHTML = sug.map((x) => `<button class="il-it" data-v="${esc(x.v)}" title="${esc(x.n)}"><img src="${esc(x.src)}" alt=""><small>${esc(x.n)}</small></button>`).join('');
    $('.il-sg').addEventListener('click', (e) => { const b = e.target.closest('.il-it'); if (!b) return; o.audio.play('UI_Button_Touch'); st.sel = b.dataset.v; showSel(); panel.hidden = true; $('.il-dd').classList.remove('open'); });
  }
  showSel();
  // 처음 열 때 드롭다운을 펼쳐 둔다 (이 앱의 용도로 걸러서)
  panel.hidden = false; $('.il-dd').classList.add('open'); draw();
}
