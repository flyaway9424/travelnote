# TripNote (여행노트)

여행 일정·지도·가계부·노트·체크리스트·일기를 한곳에 기록하는 여행 앱.
웹: https://flyaway9424.github.io/travelnote/ · 안드로이드: GitHub Actions에서 만든 TripNote APK · 아이폰: 사파리 → 홈 화면에 추가

자세한 설명(기능, 구조, 데이터, 보안 규칙, 배포, 변경 이력)은 "TripNote 앱 소개·개발 문서"를 보세요.

## 폴더

| 경로 | 역할 |
| --- | --- |
| `www/index.html` | 화면과 모든 기능 |
| `www/cloud.js` | Firebase 로그인·저장·동기화·공유·첨부 |
| `www/firebase-config.js` | Firebase 프로젝트 설정값 |
| `www/sw.js` | 오프라인 캐시 |
| `www/manifest.webmanifest`, `www/icon-*.png` | 웹앱 이름·아이콘 |
| `assets/` | 안드로이드 아이콘·시작 화면 원본 |
| `vendor.mjs` | 빌드 때 Firebase SDK(app·firestore·auth 10.12.5)를 `www/vendor/`로 받음 |
| `package.json`, `capacitor.config.json` | 안드로이드 앱 껍데기(Capacitor 6) 설정 |
| `.github/workflows/build.yml` | `main`에 올리면 웹 배포 + APK 빌드 |
| `firestore.rules` | Firestore 보안 규칙 (Firebase 콘솔에 붙여넣어 적용) |

## 배포

1. `main`에 올리면 Actions가 웹(GitHub Pages)과 APK를 같이 만든다.
2. `www/`만 바꿨다면 웹·앱 모두 자동 반영 (앱은 껐다 켜기).
3. `package.json`, `capacitor.config.json`, `assets/`, `build.yml`을 바꿨다면 Actions의 Artifacts에서 `TripNote-apk`를 받아 다시 설치.

## 처음 설정할 때

- Firebase 콘솔: Authentication → 로그인 방법 → 이메일/비밀번호 사용 설정
- Firebase 콘솔: Firestore → 규칙 → `firestore.rules` 내용 붙여넣고 게시
- Google Cloud: Maps JavaScript API, Places API (New) 사용 설정. 키는 웹사이트 `https://flyaway9424.github.io/*`로 제한하고 `www/index.html`의 `GMAPS_KEY`에 넣는다.
