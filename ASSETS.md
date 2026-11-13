# 에셋 장부 (ASSETS.md)

이 저장소에 들어 있는 **모든 그림 · 소리 · 글꼴 파일의 출처와 사용 근거**입니다.
`tools/check_assets.py` 가 CI 에서 이 표를 읽어, **여기에 등록되지 않은 파일이 하나라도 있으면 빌드를 실패**시킵니다.

> 원칙: 블루 아카이브 등 원작 게임에서 추출한 파일(모델 · 음성 · 음악 · 그림 · 텍스처 · 데이터)은 넣지 않습니다.
> 새 파일을 넣을 때는 아래 표에 한 줄을 추가하고, 허락받은 자료라면 증빙(링크 · 날짜)을 남겨 주세요.

| 경로 (glob) | 종류 | 출처 · 작가 | 라이선스 · 허락 | 비고 |
|---|---|---|---|---|
| `app/assets/ui/*.svg` | UI 아이콘 | CTkross (자체 제작) | 이 저장소 라이선스 | `tools/make_ui_icons.py` 로 생성 |
| `app/assets/img/icon.svg` | 앱 아이콘 | CTkross (자체 제작) | 이 저장소 라이선스 | |
| `app/assets/img/icon-*.png` | 앱 아이콘 | CTkross (자체 제작) | 이 저장소 라이선스 | `icon.svg` 를 그대로 래스터화 |
| `android/app/src/main/res/mipmap-*/ic_launcher.png` | 앱 아이콘 | CTkross (자체 제작) | 이 저장소 라이선스 | `icon.svg` 를 그대로 래스터화 |
| `app/packs/default/**/*.svg` | 기본 팩 캐릭터 '루미' · 배경 | CTkross (자체 제작) | 이 저장소 라이선스 | `tools/make_default_pack.py` 로 생성 |
| `app/assets/fonts/GyeonggiTitleBold.woff2` | 글꼴 | 경기도 (경기천년제목 Bold) | 경기천년체 무료 배포 (재배포 가능 · 글꼴 자체 판매 금지) | https://www.gg.go.kr/contents/contents.do?ciIdx=679&menuId=2457 |
| `app/assets/fonts/Anton-Regular.ttf` | 글꼴 | Vernon Adams (Google Fonts) | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Anton |
| `app/assets/fonts/ZenDots-Regular.ttf` | 글꼴 | Yoshimichi Ohira (Google Fonts) | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Zen+Dots |

## 효과음

효과음은 파일이 없습니다. `app/js/audio.js` 가 WebAudio 로 직접 합성합니다.

## 캐릭터 팩을 추가할 때

`app/packs/<팩>/` 아래의 파일도 모두 이 표에 등록해야 합니다. 팩 폴더의 `CREDITS.md` 에 작가 · 허락 내역을 함께 남겨 주세요.
