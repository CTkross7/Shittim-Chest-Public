// ★ [Unofficial] 싯딤의 상자 — 개인화 설정. 이 파일만 고치면 됩니다.
// 앱 목록은 실행 중 [설정 → 앱 편집]에서도 바꿀 수 있고, 그 값이 이 파일보다 우선합니다.
window.SHITTIM = {
  senseiName: '',          // "○○ 선생님" (비워 두면 그냥 "선생님")
  level: 90,
  volume: 0.8,             // 효과음 0~1
  bgmVolume: 0.35,         // 배경음 0~1

  // ── 안드로이드 앱 실행 방법 ────────────────────────────────────
  //  1) 웹 주소:      https://www.google.com
  //  2) 앱 직접 실행: intent://#Intent;package=<패키지명>;end
  //     예) 카카오톡  intent://#Intent;package=com.kakao.talk;end
  //         유튜브    intent://#Intent;package=com.google.android.youtube;end
  //     패키지명은 Play 스토어 주소의 ?id= 뒤 문자열입니다.
  //  3) 주소를 비워 두면 캐릭터가 안내 대사만 합니다.
  //  icon 은 이모지 한 글자, 또는 이미지 경로 (예: 'assets/ui/chat.svg' — UI 아이콘은 assets/ui/ 에 있음)

  // 하단 바 (8칸)
  dock: [
    { icon: '🌐', name: '브라우저', url: 'https://www.google.com' },
    { icon: '▶️', name: '유튜브',   url: 'intent://#Intent;package=com.google.android.youtube;end' },
    { icon: 'assets/ui/chat.svg', name: '메신저',   url: 'intent://#Intent;package=com.kakao.talk;end' },
    { icon: '🎵', name: '음악',     url: 'intent://#Intent;package=com.google.android.apps.youtube.music;end' },
    { icon: 'assets/ui/schedule.svg', name: '캘린더',   url: 'https://calendar.google.com' },
    { icon: '🖼️', name: '사진',     url: 'intent://#Intent;package=com.google.android.apps.photos;end' },
    { icon: 'assets/ui/task.svg', name: '메모',     url: 'https://keep.google.com' },
    { icon: 'assets/ui/shittim.svg', name: '파일',     url: 'intent://#Intent;package=com.google.android.documentsui;end' },
  ],

  // 전체 앱 (오른쪽 아래 큰 버튼)
  drawer: [
    { icon: '🎬', name: '넷플릭스', url: 'intent://#Intent;package=com.netflix.mediaclient;end' },
    { icon: '🗺️', name: '지도',     url: 'https://maps.google.com' },
    { icon: 'assets/ui/mail.svg', name: '메일',     url: 'https://mail.google.com' },
    { icon: '☁️', name: '날씨',     url: 'https://weather.naver.com' },
    { icon: '🔢', name: '계산기',   url: 'intent://#Intent;package=com.google.android.calculator;end' },
    { icon: '📷', name: '카메라',   url: 'intent://#Intent;action=android.media.action.STILL_IMAGE_CAMERA;end' },
    { icon: '⏰', name: '시계',     url: 'intent://#Intent;package=com.google.android.deskclock;end' },
    { icon: 'assets/ui/shop.svg', name: '스토어',   url: 'https://play.google.com/store' },
    { icon: 'assets/ui/book.svg', name: '웹툰',     url: 'https://comic.naver.com' },
    { icon: '🎮', name: '게임',     url: 'intent://#Intent;package=com.google.android.play.games;end' },
    { icon: '🔍', name: '검색',     url: 'https://www.google.com/search?q=' },
    { icon: 'assets/ui/settings.svg', name: '기기 설정', url: 'intent://#Intent;action=android.settings.SETTINGS;end' },
  ],

  // 상단 시계를 눌렀을 때
  clockApp: 'intent://#Intent;package=com.google.android.deskclock;end',
};
