# 개인정보처리방침 — [Unofficial] 싯딤의 상자

시행일: 2026-11-13 · 개발: CTkross

1. **수집하는 정보 없음.** 이 앱은 개인정보를 수집 · 저장 · 전송하지 않습니다.
2. **기기 안에서만 쓰는 정보**
   - 설치된 앱 목록 · 앱 아이콘: 런처 화면에 앱을 보여 주기 위해 (`QUERY_ALL_PACKAGES`)
   - 배터리 · 네트워크 상태 · 저장공간: 화면 표시와 캐릭터 대사를 위해
   - 홈 화면 배치 · 설정: 기기 안의 앱 저장소에만 저장됩니다. 백업 파일은 사용자가 직접 내보낼 때만 만들어집니다.
3. **인터넷 사용:** 새 버전 확인(GitHub Releases, `api.github.com`)에만 씁니다. 이때 기기 정보를 보내지 않습니다.
4. **권한**
   - `QUERY_ALL_PACKAGES`: 런처 — 설치된 앱 목록
   - `REQUEST_INSTALL_PACKAGES`: 새 버전 설치 (사용자가 확인할 때만)
   - `REQUEST_DELETE_PACKAGES`: 홈 화면에서 앱 삭제 (사용자가 고를 때만)
   - `SET_WALLPAPER`: 기기 배경화면 맞추기 (설정에서 켰을 때만)
   - `POST_NOTIFICATIONS`: 업데이트 알림
   - 알림 접근 · 캘린더 권한은 쓰지 않습니다.
5. 문의: https://github.com/CTkross7/Shittim-Chest-Public/issues
