// 캐릭터 팩 (packs/<팩>/pack.json → chara/<id>/chara.json)
// 코어 앱에는 넥슨 IP 가 없다. 블루 아카이브 팬 팩은 따로 넣는다 (docs/PACKS.md).
// chara.json: 이름 · 테마 색 · 움직임 값 · 포즈별 레이어 · 대사(lines) · 상황 대사(situ) · 배경(bg)

/** 시간대: 아침 5~11 · 낮 11~17 · 저녁 17~20 · 밤 20~5 */
export const slotOf = (h = new Date().getHours()) => (h >= 5 && h < 11 ? 'morning' : h < 17 && h >= 11 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night');

export const CHARS = [];
export const LINES = {};     // id → { in, talk, cafe, … }
export const SITU = {};      // id → { morning, low, … }
const BGS = {};

/** 팩 목록을 읽는다 (앱 시작 때 한 번). 읽지 못한 팩 · 캐릭터는 건너뛴다 */
export async function loadPacks() {
  const j = async (u) => { try { const r = await fetch(u); return r.ok ? r.json() : null; } catch (_) { return null; } };
  const idx = (await j('packs/index.json')) || { packs: ['default'] };
  for (const pid of idx.packs || []) {
    const root = `packs/${pid}/`, pack = await j(root + 'pack.json');
    if (!pack) continue;
    for (const cid of pack.chars || []) {
      const base = `${root}chara/${cid}/`, c = await j(base + 'chara.json');
      if (!c || !c.poses) continue;
      const id = c.id || cid;
      const poses = {};
      for (const [k, p] of Object.entries(c.poses)) {
        poses[k] = { rig: p.rig || 'still', base: base + (p.dir || ''), w: p.w, h: p.h, layers: p.layers || {}, faces: p.faces || {}, anchor: p.anchor || {}, face0: c.face0 };
      }
      CHARS.push({
        id, base, pack: pid, packName: pack.name, author: pack.author, license: pack.license,
        name: c.name || id, school: c.affil || '', color: c.color || '#4a9be8',
        icon: c.icon ? base + c.icon : '', face0: c.face0, poses, pose0: c.pose0 || Object.keys(poses)[0],
        breath: c.breath ?? 3.6, sway: c.sway ?? 0.5, bob: c.bob ?? 0.4, neck: c.neck, cx: c.cx,
        tap: c.tap || ['jump'], head: c.head || ['nod'], em: c.em || [], talkEvery: c.talkEvery || 60,
        moods: c.moods || null, bgm: c.bgm ? Object.fromEntries(Object.entries(c.bgm).map(([k, v]) => [k, v.startsWith('packs/') ? v : root + v])) : null,
      });
      LINES[id] = c.lines || {};
      SITU[id] = c.situ || {};
      if (c.bg) BGS[id] = Object.fromEntries(Object.entries(c.bg).map(([k, L]) => [k, L.map((n) => (n.startsWith('packs/') ? n : root + 'bg/' + (/\.\w+$/.test(n) ? n : n + '.svg')))]));
    }
  }
}
/** 그 캐릭터의 시간대별 배경 후보 (주소 목록) */
export const bgsOf = (id) => BGS[id] || null;
export const byId = (id) => CHARS.find((c) => c.id === id) || CHARS[0];
/** 지금 포즈의 리그 모델 */
export const modelOf = (c, pose) => c.poses[pose] || c.poses[c.pose0];
