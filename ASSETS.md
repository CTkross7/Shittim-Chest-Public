# 에셋 장부 (ASSETS.md)

이 저장소에 들어 있는 **모든 그림 · 소리 · 글꼴 파일의 출처와 사용 근거**입니다.
`tools/check_assets.py` 가 CI 에서 이 표를 읽어, **여기에 등록되지 않은 파일이 하나라도 있으면 빌드를 실패**시킵니다.

> 원칙: 원작 게임에서 추출한 파일(모델 · 음성 · 그림 · 텍스처 · 효과음 · 데이터)은 넣지 않습니다. 공식 OST 는 출처를 표기해 씁니다.
> 새 파일을 넣을 때는 아래 표에 한 줄을 추가하고, 허락받은 자료라면 증빙(링크 · 날짜)을 남겨 주세요.

| 경로 (glob) | 종류 | 출처 · 작가 | 라이선스 · 허락 | 비고 |
|---|---|---|---|---|
| `app/assets/ui/*.svg` | UI 아이콘 (블아 스타일 카드 · 싯딤 엠블럼) | CTkross (자체 제작) | 이 저장소 라이선스 · 엠블럼 디자인은 NEXON Games | `tools/make_ui_icons.py` 로 생성 |
| `app/assets/img/icon.svg` | 앱 아이콘 | CTkross (자체 제작) | 이 저장소 라이선스 | |
| `app/assets/img/icon-*.png` | 앱 아이콘 | CTkross (자체 제작) | 이 저장소 라이선스 | `icon.svg` 를 그대로 래스터화 |
| `android/app/src/main/res/mipmap-*/ic_launcher.png` | 앱 아이콘 | CTkross (자체 제작) | 이 저장소 라이선스 | `icon.svg` 를 그대로 래스터화 |
| `app/packs/arona/chara/arona/poses/stand/*.png` | 아로나 팬아트 (파트 레이어) | CTkross — AI 로 새로 그린 팬아트 | 팬아트 · 캐릭터 권리는 NEXON Games | 원본 `tools/rig/src/arona_model.png` → `tools/rig/make_layers.py` |
| `tools/rig/src/arona_model.png` | 아로나 팬아트 원본 | CTkross — AI 로 새로 그린 팬아트 | 팬아트 · 캐릭터 권리는 NEXON Games | 게임 리소스 추출 아님 |
| `app/packs/arona/chara/arona/icon.jpg` | 아로나 프로필 | 위 팬아트에서 잘라 낸 것 | 위와 같음 | |
| `app/packs/arona/bg/room_*.jpg` | 교실 배경 (낮 · 밤) | CTkross — AI 로 새로 그린 그림 (밤은 색 보정) | 자체 제작 | 게임 리소스 추출 아님 |
| `app/packs/arona/bgm/*.ogg` | 배경음 | 블루 아카이브 공식 OST (NEXON Games) | 넥슨 게임 IP 사용 가이드 ③ 출처 표기 · 비영리 | https://www.youtube.com/channel/UCj0iColXMAjPA92rH-AXVGQ |
| `app/assets/icons/ba/*.webp` | 블아 스타일 앱 아이콘 | CTkross (자체 제작 카드) + Simple Icons 로고 모양 | Simple Icons CC0 · 로고 상표권은 각 회사 | `tools/ba_icons.js` · `tools/ba_icons_pack.py` 로 생성 |
| `app/assets/fonts/GyeonggiTitleBold.woff2` | 글꼴 | 경기도 (경기천년제목 Bold) | 경기천년체 무료 배포 (재배포 가능 · 글꼴 자체 판매 금지) | https://www.gg.go.kr/contents/contents.do?ciIdx=679&menuId=2457 |
| `app/assets/fonts/Anton-Regular.ttf` | 글꼴 | Vernon Adams (Google Fonts) | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Anton |
| `app/assets/fonts/ZenDots-Regular.ttf` | 글꼴 | Yoshimichi Ohira (Google Fonts) | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Zen+Dots |

## 효과음

효과음은 파일이 없습니다. `app/js/audio.js` 가 WebAudio 로 직접 합성합니다.

## 캐릭터 팩을 추가할 때

`app/packs/<팩>/` 아래의 파일도 모두 이 표에 등록해야 합니다. 팩 폴더의 `CREDITS.md` 에 작가 · 허락 내역을 함께 남겨 주세요.
