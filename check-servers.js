const http = require('http');
const https = require('https');

// 서버 상태 확인 함수
function checkServer(host, port, name) {
  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port: port,
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      resolve({
        name: name,
        status: '✅ RUNNING',
        port: port,
        response: res.statusCode
      });
    });

    req.on('error', (err) => {
      resolve({
        name: name,
        status: '❌ OFFLINE',
        port: port,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: name,
        status: '⏰ TIMEOUT',
        port: port,
        error: 'Connection timeout'
      });
    });

    req.setTimeout(3000);
    req.end();
  });
}

// 메인 실행 함수
async function checkAllServers() {
  console.log('🔍 Discord Clone 서버 상태 확인');
  console.log('=====================================');
  console.log('');

  const servers = [
    { host: 'localhost', port: 3000, name: 'Frontend (React)' },
    { host: 'localhost', port: 5000, name: 'Backend (Express)' }
  ];

  const results = [];
  
  for (const server of servers) {
    const result = await checkServer(server.host, server.port, server.name);
    results.push(result);
  }

  // 결과 출력
  results.forEach(result => {
    console.log(`${result.status} ${result.name} - Port ${result.port}`);
    if (result.error) {
      console.log(`   오류: ${result.error}`);
    }
    if (result.response) {
      console.log(`   응답: HTTP ${result.response}`);
    }
    console.log('');
  });

  // 요약
  const running = results.filter(r => r.status.includes('✅')).length;
  const total = results.length;
  
  console.log('📊 요약');
  console.log('=====================================');
  console.log(`실행 중: ${running}/${total} 서버`);
  
  if (running === total) {
    console.log('🎉 모든 서버가 정상 실행 중입니다!');
    console.log('🌐 접속 URL:');
    console.log('   - 프론트엔드: http://localhost:3000');
    console.log('   - 백엔드 API: http://localhost:5000');
  } else {
    console.log('⚠️  일부 서버가 실행되지 않았습니다.');
    console.log('💡 해결 방법:');
    console.log('   - 프론트엔드: cd frontend && npm run dev');
    console.log('   - 백엔드: cd backend && npm run dev');
  }

  console.log('');
  console.log('🔄 5초 후 자동 새로고침...');
  
  setTimeout(() => {
    console.clear();
    checkAllServers();
  }, 5000);
}

// Ctrl+C 처리
process.on('SIGINT', () => {
  console.log('\n👋 서버 상태 확인을 종료합니다.');
  process.exit(0);
});

// 시작
checkAllServers();
