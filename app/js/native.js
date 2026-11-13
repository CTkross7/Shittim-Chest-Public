// 안드로이드 앱(APK) 연동. 브라우저에서 열면 N 은 null 이고 아무것도 하지 않는다.
// 기기 → 페이지 이벤트: battery · network · apps · resume · home · back · update · updateProgress · updateError · updateNone · lockshow
export const N = window.ShittimNative || null;
export const isNative = !!N;

const L = {};
window.__native = (type, data) => (L[type] || []).forEach((f) => { try { f(data); } catch (e) { console.warn(e); } });
export const on = (type, f) => (L[type] || (L[type] = [])).push(f);

const json = (fn, d) => { try { return JSON.parse(fn()); } catch (_) { return d; } };
export const info = () => (N ? json(() => N.info(), {}) : {});
export const battery = () => (N ? json(() => N.battery(), {}) : {});
export const device = () => (N ? json(() => N.device(), {}) : {});
let appCache = null;
export const apps = (fresh = false) => {
  if (!N) return [];
  if (!appCache || fresh) appCache = json(() => N.apps(), []);
  return appCache;
};
on('apps', () => { appCache = null; });

// ── 아이콘 테마: 자주 쓰는 앱을 앱 자체 UI 아이콘(assets/ui, 자체 제작)으로 바꿔 보여 준다 ──
const THEME = [
  // 순서대로 처음 맞는 것을 쓴다 (패키지 이름 기준)
  [/kakao\.talk|messenger|whatsapp|jp\.naver\.line|telegram|discord|android\.apps\.messaging|samsung\.android\.messaging|android\.mms/, 'chat'],
  [/calculator|popupcalculator/, 'tablet'],
  [/calendar/, 'schedule'],
  [/deskclock|\.clock|alarm/, 'mission'],
  [/(^|\.)settings$|android\.settings/, 'codex'],
  [/bixby|assistant|googlequicksearchbox/, 'mail'],
  [/onestore|skt\.skaf|tstore/, 'tag'],
  [/documentsui|myfiles|files|filemanager/, 'shittim'],
  [/sbrowser|naver\.whale|opera|firefox|android\.browser|microsoft\.emmx/, 'search'],
  [/ahnlab|v3|security|antivirus|vaccine/, 'shield'],
  [/play\.games|gamelauncher|gamehome|games/, 'sword'],
  [/photos|gallery|\.photo/, 'gallery'],
  [/maps|navi|kakaomap|nmap|tmap/, 'tower'],
  [/samsung\.ecom|shop\.samsung|coupang|11st|gmarket|musinsa/, 'bag'],
  [/smartthings|oneconnect|iot|home\.app/, 'gear'],
  [/samsung\.android\.voc|members/, 'question'],
  [/shealth|health|fitness/, 'mission'],
  [/samsung\.android\.spay|wallet|pay$|tossmain|kakaopay/, 'wallet'],
  [/keep|notes|memo|notion|onenote/, 'notes'],
  [/android\.vending/, 'store24'],
  [/galaxyapps|samsungapps|appstore/, 'shop'],
  [/globalgoals|sdg/, 'stars'],
  [/tvplus|samsung\.android\.app\.spage|free/, 'question'],
  [/android\.gm$|\.email|mail/, 'mail2'],
  [/webtoon|comic|books|kindle|ridi|series|kakaopage/, 'book'],
  [/youtube\.music|spotify|melon|genie|flo|bugs|music/, 'cafe'],
  [/contacts|dialer|android\.phone/, 'student'],
  [/weather/, 'cloud'],
  [/docs|sheets|slides|office|drive|hancom/, 'office'],
  [/event|reward|gift/, 'gift'],
  [/notice|news/, 'notice2'],
];
export function themedIcon(pkg) {
  for (const [re, ic] of THEME) if (re.test(pkg)) return `assets/ui/${ic}.svg`;
  return null;
}
export function iconUrl(pkg, themed = true) {
  // r: 아이콘 팩을 바꾸면 올라가는 번호 (앱의 아이콘 캐시를 새로 받게)
  let r = 0; try { r = +(localStorage.getItem('shittim.iconRev') || 0); } catch (_) { /* 저장소 없음 */ }
  return (themed && themedIcon(pkg)) || `/icon/${pkg}.png?r=${r}`;
}

// 하단 바 기본값: 설치된 앱 중에서 이 순서로 고른다
const PREFERRED = [
  /android\.chrome|sec\.android\.app\.sbrowser|browser/, /youtube$|android\.youtube$/, /kakao\.talk|messaging/, /youtube\.music|spotify|melon|music/,
  /calendar/, /photos|gallery/, /keep|notes|memo/, /documentsui|myfiles|files/,
];
export function defaultDock() {
  const list = apps(); const used = new Set(); const out = [];
  for (const re of PREFERRED) {
    const a = list.find((x) => re.test(x.pkg) && !used.has(x.pkg));
    if (a) { used.add(a.pkg); out.push({ pkg: a.pkg, label: a.label }); }
  }
  for (const a of list) { if (out.length >= 8) break; if (!used.has(a.pkg) && !a.system) { used.add(a.pkg); out.push({ pkg: a.pkg, label: a.label }); } }
  while (out.length < 8) out.push({ pkg: '', label: '' });
  return out.slice(0, 8);
}

export const fmtBytes = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + 'GB' : (n / 1e6).toFixed(0) + 'MB');

// ── 런처 기능 (One UI 홈처럼) ──
/** 아이콘 바꾸기에서 고를 수 있는 UI 아이콘 (assets/ui) */
export const UI_ICONS = ['chat', 'schedule', 'mission', 'codex', 'settings', 'gallery', 'search', 'mail', 'mail2', 'notes', 'notice', 'notice2', 'shittim', 'tablet', 'shop', 'store24', 'bag', 'wallet', 'tag', 'gift', 'cafe', 'house', 'office', 'tower', 'student', 'book', 'task', 'check', 'stars', 'cloud', 'gear', 'shield', 'sword', 'question', 'menu'];
export const shortcuts = (pkg) => (N && N.shortcuts ? json(() => N.shortcuts(pkg), []) : []);
export const badges = () => ({});      // 배포판: 알림 접근을 쓰지 않는다 (앱 아이콘 배지 없음)
/** 문자열 설정 백업 (localStorage 가 지워져도 홈 배치를 되살린다) */
export const backup = { set: (k, v) => { try { N && N.setStr && N.setStr(k, v); } catch (_) {} }, get: (k) => { try { return (N && N.getStr && N.getStr(k)) || ''; } catch (_) { return ''; } } };

/** 아이콘 팩 (노바 · ADW 형식) */
export const iconPacks = () => (N && N.iconPacks ? json(() => N.iconPacks(), []) : []);
export const iconPack = () => { try { return (N && N.iconPack && N.iconPack()) || ''; } catch (_) { return ''; } };
