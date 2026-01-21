import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'simple-enum', enum: UserRole, default: UserRole.AGENCY })
  role: UserRole;

  @Column({ type: 'simple-enum', enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  @Column()
  businessName: string;

  @Column({ nullable: true, length: 16 })
  businessRegNo: string;

  @Column({ nullable: true })
  displayName: string;

  @Column({ nullable: true })
  name: string; // 하위 호환성

  @Column({ nullable: true, length: 30 })
  contactName?: string;

  @Column({ nullable: true, length: 16 })
  phone?: string;

  @Column({ nullable: true, length: 50 })
  companyName?: string;

  @Column({ nullable: true, length: 30 })
  refundBank?: string;

  @Column({ nullable: true, length: 30 })
  refundHolder?: string;

  @Column({ nullable: true, length: 40 })
  refundAccount?: string;

  @Column({ nullable: true, length: 30 })
  contactPosition?: string;

  @Column({ nullable: true, length: 16 })
  contactPhone?: string;

  @Column({ nullable: true, length: 100 })
  businessAddress1?: string;

  @Column({ nullable: true, length: 100 })
  businessAddress2?: string;

  @Column({ nullable: true, length: 10 })
  businessZipCode?: string;

  @Column({ nullable: true, length: 500 })
  integrationMemo?: string;

  @Column({ nullable: true, length: 200 })
  slackWebhookUrl?: string;

  @Column({ type: 'boolean', default: true })
  notifyByEmail: boolean;

  @Column({ type: 'boolean', default: false })
  notifyBySms: boolean;

  @Column({ type: 'boolean', default: false })
  notifyBySlack: boolean;

  @Column({ nullable: true })
  agencyId: string;

  @Column({ type: 'int', default: 0 })
  defaultUnitPrice: number;

  @Column({ nullable: true, length: 500 })
  rejectedReason?: string | null;

  @Column({ nullable: true })
  approvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

