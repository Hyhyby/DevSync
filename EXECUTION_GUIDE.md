# DevSync 실행 가이드

## 🚀 빠른 시작

### 1. 환경 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# API 서버 설정
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_SOCKET_URL=http://localhost:3001

# JWT 시크릿 키
JWT_SECRET=devsync-secret-key-change-in-production

# 데이터베이스 설정 (SQLite - 개발용)
DB_DIALECT=sqlite
DB_STORAGE=./database/devsync.db

# 포트 설정
PORT=3001

# 개발 모드 설정
NODE_ENV=development
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 개발 모드 실행

#### 옵션 1: 전체 개발 환경 실행 (권장)

```bash
npm run dev
```

이 명령어는 다음을 동시에 실행합니다:

- 백엔드 서버 (포트 3001)
- React 개발 서버 (포트 3000)
- Electron 데스크톱 앱

#### 옵션 2: 개별 실행

```bash
# 백엔드 서버만 실행
npm run server

# React 개발 서버만 실행 (새 터미널에서)
npm start

# Electron 앱만 실행 (새 터미널에서)
npm run electron-dev
```

## 📋 주요 기능 테스트

### 1. 회원가입 및 로그인

1. 앱 실행 후 회원가입 화면에서 계정 생성
2. 로그인하여 메인 화면 접근

### 2. 채팅 기능

1. 홈 화면에서 "새 채팅방" 버튼 클릭
2. 채팅방 생성 및 참여자 초대
3. 실시간 메시지 송수신 테스트

### 3. 설정 기능

1. 사이드바에서 "설정" 클릭
2. 프로필 수정, 비밀번호 변경 테스트
3. 테마 변경 테스트

## 🔧 개발 도구

### API 테스트

- **Postman** 또는 **Insomnia** 사용
- Base URL: `http://localhost:3001/api`
- 헤더에 `Authorization: Bearer <token>` 추가

### 데이터베이스 확인

- SQLite 파일: `./database/devsync.db`
- **DB Browser for SQLite** 사용하여 데이터 확인

### 로그 확인

- 서버 로그: 터미널에서 실시간 확인
- 더티체킹 로그: 엔티티 변경 시 자동 출력

## 🐛 문제 해결

### 포트 충돌

```bash
# 포트 사용 중인 프로세스 확인
netstat -ano | findstr :3001
netstat -ano | findstr :3000

# 프로세스 종료 (Windows)
taskkill /PID <PID> /F
```

### 데이터베이스 초기화

```bash
# 데이터베이스 파일 삭제 후 재시작
rm ./database/devsync.db
npm run dev
```

### 캐시 문제

```bash
# npm 캐시 정리
npm cache clean --force

# node_modules 재설치
rm -rf node_modules
npm install
```

## 📊 성능 모니터링

### 서버 상태 확인

```bash
# 헬스 체크
curl http://localhost:3001/api/health
```

### 데이터베이스 연결 확인

- 서버 시작 시 로그에서 "✅ 데이터베이스 연결 성공" 확인

## 🔒 보안 설정

### 프로덕션 환경

1. `.env` 파일에서 강력한 JWT_SECRET 설정
2. `NODE_ENV=production` 설정
3. PostgreSQL 사용 권장

### 환경 변수 보안

- `.env` 파일을 `.gitignore`에 추가
- 프로덕션에서는 환경 변수로 직접 설정

## 📱 빌드 및 배포

### React 앱 빌드

```bash
npm run build
```

### Electron 앱 패키징

```bash
npm run electron-pack
```

### 배포 파일 위치

- Windows: `./dist/DevSync Setup.exe`
- macOS: `./dist/DevSync.dmg`
- Linux: `./dist/DevSync.AppImage`

## 🎯 다음 단계

1. **파일 업로드 기능** 추가
2. **이미지 미리보기** 구현
3. **메시지 검색** 기능
4. **알림 시스템** 구현
5. **다국어 지원** 추가

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. Node.js 버전 (v16 이상 권장)
2. 포트 사용 가능 여부
3. 환경 변수 설정
4. 데이터베이스 파일 권한

---

**DevSync** - 개발자를 위한 데스크톱 메신저 앱 🚀
