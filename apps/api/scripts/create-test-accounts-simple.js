// 간단한 테스트 계정 생성 스크립트 (Node.js 직접 실행)
// 사용법: node scripts/create-test-accounts-simple.js

const https = require('http');

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

const accounts = [
  {
    email: 'admin@test.com',
    password: 'admin123',
    role: 'ADMIN',
    name: '테스트 관리자',
  },
  {
    email: 'agency1@test.com',
    password: 'agency123',
    role: 'AGENCY',
    name: '테스트 대행사 1',
  },
  {
    email: 'agency2@test.com',
    password: 'agency123',
    role: 'AGENCY',
    name: '테스트 대행사 2',
  },
];

async function createAccount(account) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(account);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/auth/signup',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          resolve({ success: true, message: body });
        } else {
          resolve({ success: false, statusCode: res.statusCode, message: body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🚀 테스트 계정 생성 시작...\n');
  
  for (const account of accounts) {
    console.log(`📝 생성 중: ${account.email} (${account.role})...`);
    const result = await createAccount(account);
    
    if (result.success) {
      console.log(`✅ 성공: ${account.email}`);
    } else {
      if (result.statusCode === 409) {
        console.log(`⚠️  이미 존재: ${account.email}`);
      } else {
        console.log(`❌ 실패: ${account.email} - ${result.message}`);
      }
    }
  }
  
  console.log('\n✨ 완료!\n');
  console.log('📋 테스트 계정 정보:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('관리자 계정:');
  console.log('  이메일: admin@test.com');
  console.log('  비밀번호: admin123');
  console.log('\n대행사 계정 1:');
  console.log('  이메일: agency1@test.com');
  console.log('  비밀번호: agency123');
  console.log('\n대행사 계정 2:');
  console.log('  이메일: agency2@test.com');
  console.log('  비밀번호: agency123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);









