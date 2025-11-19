const { Sequelize } = require('sequelize');
const path = require('path');

// 환경 변수에서 데이터베이스 설정 가져오기
const DB_DIALECT = process.env.DB_DIALECT || 'sqlite';
const DB_STORAGE = process.env.DB_STORAGE || path.join(__dirname, '../database/devsync.db');
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_NAME = process.env.DB_NAME || 'devsync';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'password';

let sequelize;

if (DB_DIALECT === 'sqlite') {
  // SQLite 설정 (개발용)
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: DB_STORAGE,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: true, // createdAt, updatedAt 자동 생성 (JPA Auditing과 동일)
      underscored: true, // snake_case 사용
      freezeTableName: true, // 테이블명 복수형 방지
      paranoid: false, // soft delete 비활성화 (필요시 true로 변경)
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  // PostgreSQL 설정 (운영용)
  sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: true, // createdAt, updatedAt 자동 생성
      underscored: true, // snake_case 사용
      freezeTableName: true, // 테이블명 복수형 방지
      paranoid: false, // soft delete 비활성화
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
}

// 데이터베이스 연결 테스트
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log(`✅ 데이터베이스 연결 성공 (${DB_DIALECT.toUpperCase()})`);
    
    if (DB_DIALECT === 'sqlite') {
      console.log(`📁 데이터베이스 파일: ${DB_STORAGE}`);
    } else {
      console.log(`🌐 데이터베이스 서버: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
    }
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error);
    throw error;
  }
}

// 더티체킹을 위한 헬퍼 함수
const enableDirtyChecking = (model) => {
  // Sequelize는 기본적으로 더티체킹을 지원하지만, 
  // JPA와 유사한 동작을 위해 추가 설정
  model.addHook('beforeUpdate', (instance) => {
    // 변경된 필드가 있는지 확인
    if (instance.changed()) {
      console.log(`🔄 ${model.name} 엔티티 업데이트 감지:`, instance.changed());
      // updatedAt은 자동으로 업데이트됨
    }
  });
  
  model.addHook('beforeCreate', (instance) => {
    console.log(`➕ ${model.name} 엔티티 생성:`, instance.dataValues);
  });
  
  model.addHook('beforeDestroy', (instance) => {
    console.log(`🗑️ ${model.name} 엔티티 삭제:`, instance.dataValues);
  });
};

// Auditing을 위한 공통 필드 설정
const addAuditingFields = (model) => {
  // createdAt, updatedAt은 Sequelize가 자동으로 관리
  // 추가적인 Auditing 필드가 필요하면 여기에 추가
};

module.exports = { 
  sequelize, 
  testConnection, 
  enableDirtyChecking, 
  addAuditingFields 
};
