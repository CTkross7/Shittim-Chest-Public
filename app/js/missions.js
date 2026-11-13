// 일일 미션 — 매일 새벽 4시에 새로 시작한다.
// 자동 미션: 런처 접속 · 업무 화면 (그 동작을 하면 저절로 완료)
// 손으로 체크: 기본 미션 + 선생님이 추가한 미션 (횟수 목표도 가능, 예: 물 4번)
const DEFAULTS = [
  { id: 'open', t: '런처 접속하기', goal: 1, auto: true },
  { id: 'work', t: '업무 화면 들어가기', goal: 1, auto: true },
  { id: 'water', t: '물 마시기', goal: 4 },
  { id: 'stretch', t: '스트레칭 하기', goal: 1 },
  { id: 'sleep', t: '자정 전에 자기', goal: 1 },
];
export function dayKey(d = new Date()) { const x = new Date(d.getTime() - 4 * 3600e3); return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`; }

export function createMissions(ctx) {
  const { $, store, audio, esc } = ctx;

  function defs() {
    const off = new Set(store.get('missionsOff', []));
    return [...DEFAULTS.filter((m) => !off.has(m.id)), ...store.get('missionsCustom', [])];
  }
  function state() {
    let s = store.get('missions', null);
    const k = dayKey();
    if (!s || s.day !== k) {
      // 어제 다 했으면 연속 기록 +1, 아니면 처음부터
      const prev = s; const all = prev && prev.done && prev.done.length && prev.allDone;
      const y = dayKey(new Date(Date.now() - 864e5));
      s = { day: k, c: {}, done: [], allDone: false, streak: prev && prev.day === y && all ? (prev.streak || 0) : 0, best: prev ? prev.best || 0 : 0 };
      store.set('missions', s);
    }
    return s;
  }
  function bump(id, by = 1, silent = false) {
    const s = state(), m = defs().find((x) => x.id === id); if (!m) return;
    const before = s.c[id] || 0; if (before >= m.goal) return;
    s.c[id] = Math.min(m.goal, before + by);
    let said = false;
    if (s.c[id] >= m.goal) {
      s.done.push(id);
      const list = defs();
      if (list.every((x) => (s.c[x.id] || 0) >= x.goal) && !s.allDone) {
        s.allDone = true; s.streak = (s.streak || 0) + 1; s.best = Math.max(s.best || 0, s.streak);
        if (!silent) { ctx.situ('mission_all'); said = true; }
      } else if (!silent && !m.auto) { ctx.situ('mission_done', { title: m.t }); said = true; }
    }
    store.set('missions', s);
    if (!said && !silent && !m.auto) audio.play('UI_Button_Touch');
    ctx.badge?.(left());
    if (!$('#panel').hidden && $('.ms')) render();
  }
  const left = () => { const s = state(); return defs().filter((m) => (s.c[m.id] || 0) < m.goal).length; };

  const hm = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; };

  function render() {
    const body = $('#panel-body'); const s = state();
    let html = '';
    {
      const list = defs(); const done = list.filter((m) => (s.c[m.id] || 0) >= m.goal).length;
      html = `<div class="ms-sum"><b>${done} / ${list.length}</b><span>완료</span><i style="--p:${list.length ? done / list.length : 0}"></i><small>연속 달성 ${s.streak || 0}일 · 최고 ${s.best || 0}일 · 새벽 4시에 초기화</small></div>
        <div class="ms-list">${list.map((m) => { const c = s.c[m.id] || 0, ok = c >= m.goal;
          return `<div class="ms-it${ok ? ' ok' : ''}"><span class="tx"><b>${esc(m.t)}</b><small>${m.auto ? '자동 · 하면 저절로 완료' : m.goal > 1 ? `${c} / ${m.goal}` : ok ? '완료' : '탭해서 완료'}</small><i style="--p:${c / m.goal}"></i></span>
            ${ok ? '<em>CLEAR</em>' : m.auto ? '<em class="auto">AUTO</em>' : `<button class="btn y" data-bump="${esc(m.id)}">${m.goal > 1 ? '+1' : '완료'}</button>`}
            ${m.auto ? '' : `<button class="ms-del" data-del="${esc(m.id)}" aria-label="삭제">✕</button>`}</div>`; }).join('')}</div>
        <div class="ms-add"><input id="ms-new" maxlength="30" placeholder="새 미션 (예: 영어 단어 20개)"><input id="ms-goal" type="number" min="1" max="20" value="1" title="목표 횟수"><button class="btn" id="ms-addb">추가</button></div>
        ${store.get('missionsOff', []).length ? '<button class="btn ms-restore" id="ms-restore">지운 기본 미션 되살리기</button>' : ''}`;
    }
    body.innerHTML = `<div class="ms">${html}</div>`;
  }
  function open() {
    $('#panel-title').textContent = '미션'; render(); $('#panel').hidden = false;
  }
  $('#panel-body').addEventListener('click', (e) => {
    if (!$('.ms') || !e.target.closest('.ms')) return;
    const b = e.target.closest('[data-bump]'); if (b) return bump(b.dataset.bump);
    const d = e.target.closest('[data-del]'); if (d) {
      const id = d.dataset.del; audio.play('UI_Button_Back');
      if (DEFAULTS.some((x) => x.id === id)) store.set('missionsOff', [...new Set([...store.get('missionsOff', []), id])]);
      else store.set('missionsCustom', store.get('missionsCustom', []).filter((x) => x.id !== id));
      return render();
    }
    if (e.target.closest('#ms-addb')) {
      const t = $('#ms-new').value.trim(); if (!t) return;
      const goal = Math.max(1, Math.min(20, +$('#ms-goal').value || 1));
      store.set('missionsCustom', [...store.get('missionsCustom', []), { id: 'c' + Date.now().toString(36), t, goal }]);
      audio.play('SE_Confirm_02'); return render();
    }
    if (e.target.closest('#ms-restore')) { store.set('missionsOff', []); audio.play('UI_Button_Touch'); return render(); }
  });

  setTimeout(() => ctx.badge?.(left()), 1500);
  return { open, bump, left, hm };
}
