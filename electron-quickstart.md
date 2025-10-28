# Discord Clone - Electron Quick Start

디스코드 클론을 Electron 데스크톱 앱으로 실행하는 방법입니다.

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

이 명령은 루트, 백엔드, 프론트엔드의 모든 의존성을 설치합니다.

### 2. Electron 앱 실행

#### 방법 1: 배치 파일 사용 (Windows)
```bash
start-electron.bat
```

#### 방법 2: npm 스크립트 사용
```bash
npm run electron-dev
```

## 📦 데스크톱 앱 빌드

### Windows 설치 파일 생성

```bash
build-electron.bat
```

또는

```bash
npm run build-frontend
npm run dist-win
```

빌드된 설치 파일은 `dist` 폴더에 생성됩니다.

## 🔧 개발 모드

개발 모드에서는:
- 자동으로 백엔드 서버가 시작됩니다 (http://localhost:5000)
- 자동으로 프론트엔드 개발 서버가 시작됩니다 (http://localhost:3000)
- Electron 창에서 개발자 도구가 열립니다
- 핫 리로드가 활성화됩니다

## 🏗️ 프로덕션 모드

프로덕션 모드에서는:
- 백엔드 서버가 Electron 내부에서 자동 시작됩니다
- 빌드된 프론트엔드 파일을 사용합니다
- 개발자 도구가 기본적으로 열리지 않습니다

## 📝 주의사항

1. **포트 충돌**: 이미 3000번 또는 5000번 포트를 사용 중인 프로그램이 있다면 충돌이 발생할 수 있습니다.
2. **방화벽**: Windows 방화벽에서 Node.js를 허용해야 할 수 있습니다.
3. **백엔드 자동 시작**: Electron 앱은 자동으로 백엔드를 시작합니다. 백엔드를 별도로 실행할 필요가 없습니다.

## 🐛 문제 해결

### 포트 충돌
이미 사용 중인 포트를 사용하는 경우:

1. 해당 프로세스를 종료하거나
2. `backend/.env`에서 다른 포트를 설정하세요

```env
PORT=5001
```

그리고 `electron/main.js`에서도 포트를 수정해야 합니다.

### Electron이 실행되지 않음

```bash
# 의존성 재설치
npm install

# 전역 Electron 설치 확인
npm list electron
```

### 백엔드 서버가 시작되지 않음

`backend/.env` 파일이 존재하는지 확인하세요:

```bash
cd backend
copy env.example .env
```

## 📁 파일 구조

```
discord-clone/
├── electron/
│   ├── main.js          # Electron 메인 프로세스
│   └── preload.js       # Preload 스크립트
├── start-electron.bat   # Electron 실행 배치 파일
├── build-electron.bat   # 빌드 배치 파일
└── package.json         # 루트 패키지 설정
```

## 🎯 주요 명령어

```bash
# Electron 개발 모드 실행
npm run electron-dev

# Electron 프로덕션 모드 실행
npm run electron

# 프론트엔드만 빌드
npm run build-frontend

# Windows 설치 파일 생성
npm run dist-win

# 모든 플랫폼용 빌드
npm run dist
```

## 🌟 기능

- ✅ Electron으로 네이티브 데스크톱 앱
- ✅ 백엔드 자동 시작
- ✅ 핫 리로드 지원 (개발 모드)
- ✅ 개발자 도구 지원
- ✅ Windows 설치 프로그램 생성
- ✅ 자동 서버 관리

## 📞 추가 정보

더 자세한 내용은 `README.md`를 참고하세요.
