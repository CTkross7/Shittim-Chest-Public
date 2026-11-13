# [Unofficial] 싯딤의 상자

> **비공식 팬메이드 안드로이드 런처입니다.** NEXON Games · NEXON Korea 및 블루 아카이브 공식과 **관련이 없습니다.**
>
> 개발 · **[CTkross](https://github.com/CTkross7)**

캐릭터가 홈 화면에 살아 있는 태블릿 런처입니다. 앱 아이콘 그리드 · 폴더 · 위젯 · 업무 화면 · 일일 미션과 함께,
캐릭터가 숨 쉬고 눈을 깜빡이고 표정을 바꾸며 말을 겁니다.

- **비영리 · 무료 배포**입니다. 유료로 판매하거나 대가를 받고 배포할 수 없습니다.
- **원작 게임에서 추출한 리소스(모델 · 음성 · 음악 · 그림 · 텍스처 · 데이터)는 들어 있지 않습니다.**
  모든 그림 · 소리 · 글꼴의 출처는 [ASSETS.md](ASSETS.md) 에 있고, CI 가 장부에 없는 파일을 막습니다.
- 캐릭터 · 대사 · 배경은 **캐릭터 팩**에서 불러옵니다. 기본 팩에는 자체 제작한 임시 캐릭터 '루미'가 들어 있습니다.
  팩 만드는 법은 [docs/PACKS.md](docs/PACKS.md).
- 블루 아카이브 관련 권리는 NEXON Games 에 있습니다. (넥슨 [게임 IP 사용 가이드](https://member.nexon.com/policy/gameipguide.aspx))

## 설치

[Releases](https://github.com/CTkross7/Shittim-Chest-Public/releases) 에서 최신 `ShittimChest-Unofficial-*.apk` 를 받아 설치하세요.
설치 후 [설정 → 홈 앱]에서 기본 홈 앱으로 고르면 런처로 쓸 수 있습니다. 새 버전은 앱이 GitHub Releases 에서 찾아 알려 줍니다.

## 개인정보

앱은 설치된 앱 목록 · 배터리 상태를 **기기 안에서만** 씁니다. 어떤 정보도 밖으로 보내지 않습니다. → [PRIVACY.md](PRIVACY.md)

## 개발

```bash
cd app && python3 -m http.server 8080     # 브라우저에서 http://localhost:8080
python3 tools/check_assets.py             # 에셋 장부 검사
```

APK 빌드 · 서명 키 설정은 [docs/BUILD.md](docs/BUILD.md).

| 경로 | 내용 |
|---|---|
| `app/` | 웹앱 (런처 화면 전체). APK 안에 그대로 들어간다 |
| `app/js/stillrig.js` | 정지 이미지 캐릭터 리그 (레이어 합성 + 숨쉬기 · 흔들림 셰이더 · 깜빡임 · 립싱크) |
| `app/js/packs.js` | 캐릭터 팩 로더 |
| `app/packs/` | 캐릭터 팩 (기본 팩: `default`) |
| `android/` | 안드로이드 런처 (WebView 호스트 · 앱 목록 · 아이콘 · 업데이트) |
| `tools/` | 기본 팩 · UI 아이콘 생성기, 에셋 장부 검사 |
