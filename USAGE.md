# Discord Clone - 사용 가이드

## 📥 설치 방법

### 1. 의존성 설치

프로젝트 루트에서 실행:

```bash
npm install
```

이 명령은 루트, 백엔드, 프론트엔드의 모든 의존성을 자동으로 설치합니다.

### 2. 환경 설정

백엔드 디렉토리로 이동하여 환경 설정:

```bash
cd backend
copy env.example .env
```

`.env` 파일 내용 확인:
```env
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
```

## 🚀 Electron 데스크톱 앱 실행

### 방법 1: 배치 파일 사용 (추천)

```bash
start-electron.bat
```

이 명령은:
- 자동으로 백엔드 서버를 시작합니다 (포트 5000)
- 자동으로 프론트엔드 개발 서버를 시작합니다 (포트 3000)
- Electron 앱 창을 엽니다

### 방법 2: npm 스크립트 사용

```bash
npm run electron-dev
```

## 🖥️ 웹 브라우저로 실행

기존 방식대로 웹으로 실행하려면:

```bash
# 서버 관리자 메뉴 사용
서버관리자.bat

# 또는 수동으로
npm run dev
```

## 📦 데스크톱 앱 빌드 (설치 파일 생성)

Windows 설치 파일을 만들려면:

```bash
build-electron.bat
```

빌드된 설치 파일은 `dist` 폴더에 생성됩니다.

### 빌드 명령어

```bash
# 프론트엔드 빌드
npm run build-frontend

# Windows 설치 파일 생성
npm run dist-win

# 모든 플랫폼용 빌드
npm run dist
```

## 🎮 사용 방법

### 1. 회원가입 / 로그인
- 앱 실행 후 회원가입 또는 로그인
- JWT 인증 사용

### 2. 채팅방 생성/참여
- 홈에서 채팅방 생성 또는 참여
- 실시간 메시징

### 3. WebRTC 통화
- 음성/영상 통화 기능 사용

## 🔧 개발 모드 vs 프로덕션 모드

### 개발 모드 (electron-dev)
- ✅ 핫 리로드 지원
- ✅ 개발자 도구 자동 열림
- ✅ Vite 개발 서버 사용
- ✅ 백엔드 자동 시작
- ✅ 실시간 코드 변경 반영

### 프로덕션 모드 (electron)
- ✅ 빌드된 정적 파일 사용
- ✅ 최적화된 성능
- ✅ 개발자 도구 없음
- ✅ 설치 파일로 패키징 가능

## 🐛 문제 해결

### 포트 충돌

기본 포트:
- 프론트엔드: 3000
- 백엔드: 5000

이미 사용 중인 경우:

1. 포트 사용 확인:
```bash
netstat -ano | findstr :3000
netstat -ano | findstr :5000
```

2. 포트 변경:
`backend/.env`에서 다른 포트로 변경

### Electron이 실행되지 않음

```bash
# 의존성 재설치
npm install

# Electron 버전 확인
npm list electron
```

### 백엔드 서버 오류

백엔드 서버가 시작되지 않으면:

1. `.env` 파일 확인:
```bash
cd backend
copy env.example .env
```

2. 포트가 사용 가능한지 확인
3. 관리자 권한으로 실행

### Socket.io 연결 오류

채팅이 작동하지 않는 경우:

1. 백엔드 서버가 실행 중인지 확인
2. 방화벽 설정 확인
3. 브라우저 콘솔에서 에러 확인

## 📁 주요 파일 위치

```
discord-clone/
├── electron/
│   ├── main.js          # Electron 메인 프로세스
│   └── preload.js       # Preload 스크립트
├── start-electron.bat   # Electron 실행 배치
├── build-electron.bat   # 빌드 배치
├── package.json         # 프로젝트 설정
└── README.md            # 상세 문서
```

## 🎯 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `npm install` | 모든 의존성 설치 |
| `npm run dev` | 웹용 서버 실행 |
| `npm run electron-dev` | Electron 개발 모드 |
| `npm run electron` | Electron 프로덕션 모드 |
| `npm run build-frontend` | 프론트엔드 빌드 |
| `npm run dist-win` | Windows 설치 파일 생성 |
| `start-electron.bat` | Electron 실행 (배치) |
| `build-electron.bat` | 빌드 (배치) |
| `서버관리자.bat` | 서버 관리 메뉴 |

## 💡 팁

1. **개발 시**: `start-electron.bat` 또는 `npm run electron-dev` 사용
2. **배포 시**: `build-electron.bat`로 설치 파일 생성
3. **디버깅**: 개발 모드에서 자동으로 열리는 개발자 도구 활용
4. **로그 확인**: `backend/logs/` 폴더에서 서버 로그 확인

## 📞 추가 지원

- 자세한 API 문서: `README.md`
- Electron 빠른 시작: `electron-quickstart.md`
- 서버 관리: `서버관리자.bat`
