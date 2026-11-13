// 업무 화면 — 큰 카드 3 · 왼쪽 기울어진 목록 · 오른쪽 타일 배치에 기기 기능을 모았다.
// 카드 그림은 앱 자체 UI 아이콘(assets/ui) + 그라데이션.
export function createWork(ctx) {
  const { $, NV, isNative, audio, esc, bubble, openDrawer, openSettings } = ctx;
  const el = $('#workscr');

  const gb = (n) => (n / 1e9).toFixed(n >= 1e11 ? 0 : 1) + 'GB';
  function model() {
    const I = isNative ? NV.info() : {}, D = isNative ? NV.device() : {}, B = isNative ? NV.battery() : {};
    const apps = isNative ? NV.apps().length : 0;
    const pend = isNative ? (() => { try { return JSON.parse(NV.N.pendingUpdate()); } catch (_) { return null; } })() : null;
    const net = { wifi: 'Wi-Fi 연결됨', cellular: '모바일 데이터', ethernet: '유선 연결', none: '연결 안 됨', other: '연결됨' }[D.network] || '—';
    return {
      top: [
        { k: 'apps', t: '전체 앱', s: isNative ? `설치된 앱 ${apps}개` : '앱 목록', art: 'apps' },
        { k: 'device', t: '기기 정보', s: isNative ? `${I.model || ''} · Android ${I.android || ''}` : '[Unofficial] 싯딤의 상자', art: 'device' },
        { k: 'update', t: '업데이트', s: pend ? `새 버전 v${pend.version}` : `v${I.version || '-'} · 최신`, art: 'update', badge: pend ? '새 버전!' : '' },
      ],
      list: [
        { k: 'wifi', t: 'Wi-Fi', s: net, art: 'wifi', badge: D.network === 'none' ? '연결 필요' : '' },
        { k: 'bluetooth', t: '블루투스', s: '기기 연결', art: 'bluetooth' },
        { k: 'display', t: '화면', s: '밝기 · 화면 시간', art: 'display' },
        { k: 'mission', t: '일일 미션', s: '오늘 할 일 보기', art: 'mission' },
      ],
      grid: [
        { k: 'battery', t: '배터리', s: B.level >= 0 ? `${B.level}%` : '', art: 'battery', badge: B.charging ? '충전 중' : B.level <= 15 ? '부족!' : '' },
        { k: 'storage', t: '저장공간', s: D.storageFree ? `${gb(D.storageFree)} 남음` : '', art: 'storage' },
        { k: 'sound', t: '소리', s: '', art: 'sound' },
        { k: 'wallpaper', t: '배경화면', s: '', art: 'wallpaper' },
        { k: 'all', t: '전체 설정', s: '', art: 'settings' },
        { k: 'credits', t: '정보 · 크레딧', s: '개발 CTkross · 비공식 팬메이드', art: 'credits' },
      ],
    };
  }
  const ART = { apps: 'menu', device: 'tablet', update: 'cloud', wifi: 'tower', bluetooth: 'chat', display: 'gallery', mission: 'mission',
    battery: 'AP', storage: 'bag', sound: 'notice', wallpaper: 'gallery', settings: 'settings', credits: 'stars' };
  const card = (c, cls) => `<button class="wk-card ${cls}" data-k="${c.k}">
      <span class="art ui" style="--ic:url('${new URL(`assets/ui/${ART[c.art] || 'shittim'}.svg`, location.href).href}')"></span>
      ${c.badge ? `<em class="bdg">${esc(c.badge)}</em>` : ''}
      <span class="tx"><b>${esc(c.t)}</b>${c.s ? `<small>${esc(c.s)}</small>` : ''}</span>
      ${cls === 'l' ? '<i class="chev"></i>' : ''}</button>`;

  function render() {
    const m = model();
    el.querySelector('.wk-row1').innerHTML = m.top.map((c) => card(c, 't')).join('');
    el.querySelector('.wk-list').innerHTML = m.list.map((c) => card(c, 'l')).join('');
    el.querySelector('.wk-grid').innerHTML = m.grid.map((c) => card(c, 'g')).join('');
    const B = isNative ? NV.battery() : {};
    el.querySelector('.wk-bat').textContent = B.level >= 0 ? `${B.level}/100` : '—';
    el.querySelector('.wk-clock').textContent = new Date().toTimeString().slice(0, 5);
  }

  function act(k) {
    audio.play('UI_Button_Touch');
    if (k === 'apps') return openDrawer({});
    if (k === 'device') return openSettings();
    if (k === 'credits') return ctx.openCredits();
    if (k === 'mission') return ctx.openMissions();
    if (k === 'update') { if (!isNative) return bubble('업데이트는 앱(APK) 버전에서 할 수 있어요.'); bubble('새 버전이 있는지 확인하고 있어요…'); return NV.N.checkUpdate(); }
    if (!isNative) return bubble('기기 설정은 앱(APK) 버전에서 열 수 있어요.');
    NV.N.openSettings(k === 'all' ? 'all' : k);
  }

  el.addEventListener('click', (e) => {
    const c = e.target.closest('.wk-card'); if (c) return act(c.dataset.k);
    if (e.target.closest('.wk-back, .wk-home')) { audio.play('UI_Button_Back'); return ctx.leave ? ctx.leave() : close(); }
    if (e.target.closest('.wk-gear')) { audio.play('UI_Button_Touch'); return openSettings(); }
  });

  function open() {
    render();
    el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    audio.play('UI_Button_Touch');
    ctx.onOpen?.();
  }
  function close() { if (el.hidden) return false; el.hidden = true; ctx.onClose?.(); return true; }
  return { open, close, render, get isOpen() { return !el.hidden; } };
}
