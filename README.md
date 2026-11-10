# 여행노트 앱 (실시간 동기화 · 백업 · APK/PWA)

## 1. Firebase 연결 (무료, 5분)
1. https://console.firebase.google.com → 프로젝트 추가
2. 빌드 > **Firestore Database** > 데이터베이스 만들기 (프로덕션 모드, 서울 asia-northeast3)
3. Firestore > **규칙** 탭에 아래를 붙여 넣고 게시
```
rules_version = '2';
service cloud.firestore { match /databases/{d}/documents {
  match /rooms/{room}/{coll}/{doc} { allow read, write: if true; }
} }
```
4. 프로젝트 설정 > 내 앱 > 웹(</>) 추가 → 나오는 `firebaseConfig` 값을 `www/firebase-config.js`에 붙여 넣기

## 2. GitHub에 올려 자동 빌드
1. 이 폴더 전체를 새 GitHub 저장소(main)에 업로드
2. 저장소 Settings > Pages > Source: **GitHub Actions**
3. Actions 탭 > 완료되면
   - **APK**: 실행 결과의 Artifacts > `travelnote-apk` 다운로드 → 폰에 설치 (안드로이드)
   - **웹앱 주소**: Pages 주소(https://아이디.github.io/저장소/)

## 3. 아이폰
네이티브 앱은 Mac+Xcode+Apple 개발자 계정이 필요해서, 웹앱 주소를 Safari로 열고 **공유 > 홈 화면에 추가**하세요. 아이콘·전체화면·오프라인까지 앱처럼 동작합니다.

## 4. 공유 · 기기 변경 · 백업
- 앱 첫 화면 **☁️ 동기화·공유**에 *보관함 코드*가 있어요. 새 폰/가족 폰에서 이 코드를 입력하면 같은 여행이 실시간으로 열립니다. **코드를 꼭 따로 적어 두세요.**
- 모든 기록은 Firestore에 실시간 저장되고, 오프라인에서도 기기에 먼저 저장 후 자동 업로드됩니다.
- 추가 안전망: 여행 화면의 백업 내보내기(JSON/CSV)를 가끔 저장하세요.
- 보안: 코드를 아는 사람만 접근 가능한 방식입니다(로그인 없음). 코드를 공개하지 마세요.
