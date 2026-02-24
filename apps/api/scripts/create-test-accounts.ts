import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { User } from '../src/user/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import { UserStatus } from '../src/common/enums/user-status.enum';

async function createTestAccounts() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: process.env.DB_NAME || 'manuscript_db',
    entities: [User],
    synchronize: false,
  });

  await dataSource.initialize();

  const userRepository = dataSource.getRepository(User);

  // 기존 계정 확인 및 업데이트
  const existingAdmin = await userRepository.findOne({ where: { email: 'admin@test.com' } });
  const existingAgency1 = await userRepository.findOne({ where: { email: 'agency1@test.com' } });
  const existingAgency2 = await userRepository.findOne({ where: { email: 'agency2@test.com' } });

  // 어드민 계정 생성/업데이트
  if (!existingAdmin) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = userRepository.create({
      email: 'admin@test.com',
      password: adminPassword,
      role: UserRole.ADMIN,
      status: UserStatus.APPROVED,
      businessName: '테스트 관리자 회사',
      businessRegNo: '000-00-00000',
      displayName: '테스트 관리자',
      name: '테스트 관리자',
      approvedAt: new Date(),
    });
    await userRepository.save(admin);
    console.log('✅ 어드민 계정 생성 완료: admin@test.com / admin123');
  } else {
    // 기존 계정 업데이트
    existingAdmin.status = UserStatus.APPROVED;
    existingAdmin.approvedAt = existingAdmin.approvedAt || new Date();
    if (!existingAdmin.businessName) {
      existingAdmin.businessName = '테스트 관리자 회사';
      existingAdmin.businessRegNo = '000-00-00000';
      existingAdmin.displayName = '테스트 관리자';
    }
    await userRepository.save(existingAdmin);
    console.log('✅ 어드민 계정 업데이트 완료: admin@test.com / admin123');
  }

  // 대행사 계정 1 생성/업데이트
  if (!existingAgency1) {
    const agency1Password = await bcrypt.hash('agency123', 10);
    const agency1 = userRepository.create({
      email: 'agency1@test.com',
      password: agency1Password,
      role: UserRole.AGENCY,
      status: UserStatus.APPROVED,
      businessName: '테스트 대행사 1',
      businessRegNo: '111-11-11111',
      displayName: '테스트 대행사 1',
      name: '테스트 대행사 1',
      approvedAt: new Date(),
    });
    await userRepository.save(agency1);
    console.log('✅ 대행사 계정 1 생성 완료: agency1@test.com / agency123');
  } else {
    existingAgency1.status = UserStatus.APPROVED;
    existingAgency1.approvedAt = existingAgency1.approvedAt || new Date();
    if (!existingAgency1.businessName) {
      existingAgency1.businessName = '테스트 대행사 1';
      existingAgency1.businessRegNo = '111-11-11111';
      existingAgency1.displayName = '테스트 대행사 1';
    }
    await userRepository.save(existingAgency1);
    console.log('✅ 대행사 계정 1 업데이트 완료: agency1@test.com / agency123');
  }

  // 대행사 계정 2 생성/업데이트
  if (!existingAgency2) {
    const agency2Password = await bcrypt.hash('agency123', 10);
    const agency2 = userRepository.create({
      email: 'agency2@test.com',
      password: agency2Password,
      role: UserRole.AGENCY,
      status: UserStatus.APPROVED,
      businessName: '테스트 대행사 2',
      businessRegNo: '222-22-22222',
      displayName: '테스트 대행사 2',
      name: '테스트 대행사 2',
      approvedAt: new Date(),
    });
    await userRepository.save(agency2);
    console.log('✅ 대행사 계정 2 생성 완료: agency2@test.com / agency123');
  } else {
    existingAgency2.status = UserStatus.APPROVED;
    existingAgency2.approvedAt = existingAgency2.approvedAt || new Date();
    if (!existingAgency2.businessName) {
      existingAgency2.businessName = '테스트 대행사 2';
      existingAgency2.businessRegNo = '222-22-22222';
      existingAgency2.displayName = '테스트 대행사 2';
    }
    await userRepository.save(existingAgency2);
    console.log('✅ 대행사 계정 2 업데이트 완료: agency2@test.com / agency123');
  }

  await dataSource.destroy();
  console.log('\n✨ 테스트 계정 생성 완료!');
}

createTestAccounts().catch(console.error);

