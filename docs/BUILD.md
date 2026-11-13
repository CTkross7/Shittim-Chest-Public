# APK 빌드 · 서명

`main` 에 push 하면 GitHub Actions 가
1. 에셋 장부 검사 (`tools/check_assets.py`)
2. 서명된 APK 빌드
3. Releases 에 `build-<번호>` 로 업로드
를 합니다. 앱은 이 Releases 에서 새 버전을 찾습니다.

## 0. 서명 키 (처음 한 번)

업데이트가 덮어써지려면 **항상 같은 키**로 서명해야 합니다. 개인용 저장소와 **다른 새 키**를 만드세요.

```bash
keytool -genkeypair -v -keystore release.jks -alias shittimchest -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 release.jks > release.jks.b64
```

저장소 Settings → Secrets and variables → Actions 에 등록:

| 이름 | 값 |
|---|---|
| `KEYSTORE_BASE64` | `release.jks.b64` 내용 |
| `KEYSTORE_PASSWORD` | 키 저장소 비밀번호 (키 비밀번호도 같게) |
| `KEY_ALIAS` | `shittimchest` (생략하면 이 값) |

`release.jks` 는 저장소에 올리지 마세요 (`.gitignore` 에 있음). 잃어버리면 기존 설치본을 업데이트할 수 없습니다 — 안전한 곳에 백업하세요.

## 로컬 빌드

```bash
echo "sdk.dir=/path/to/android-sdk" > android/local.properties
gradle -p android assembleDebug          # 디버그 키로 서명 (테스트용)
```

- 패키지: `com.ctkross.shittimchest` · 앱 이름: `[Unofficial] 싯딤의 상자`
- 개인용 버전(`com.ctkross.shittim`)과 같이 설치할 수 있습니다.
