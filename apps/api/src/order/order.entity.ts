import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, DeleteDateColumn } from 'typeorm';
import { OrderStatus } from '../common/enums/order-status.enum';
import { OrderType } from '../common/enums/order-type.enum';
import { User } from '../user/user.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'simple-enum', enum: OrderStatus, default: OrderStatus.DRAFT })
  status: OrderStatus;

  // 주문 타입 (기본: MANUSCRIPT)
  @Column({ type: 'text', default: OrderType.MANUSCRIPT })
  type: OrderType;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'agencyId' })
  agency: User;

  @Column()
  agencyId: string;

  // 플레이스 정보
  @Column()
  placeName: string;

  @Column({ nullable: true })
  placeAddress: string;

  @Column({ type: 'text', nullable: true })
  placeUrl: string;

  @Column({ nullable: true })
  searchKeywords: string;

  // 가이드 체크리스트
  @Column('text', { nullable: true })
  guideContent: string;

  @Column('simple-array', { nullable: true })
  requiredKeywords: string[];

  @Column('simple-array', { nullable: true })
  emphasisKeywords: string[];

  @Column({ default: false })
  hasLink: boolean;

  @Column({ default: false })
  hasMap: boolean;

  @Column('simple-array', { nullable: true })
  hashtags: string[];

  @Column('text', { nullable: true })
  referenceReviews: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('simple-array', { nullable: true })
  photos: string[];

  // 스냅샷/메모
  @Column('text', { nullable: true })
  adminMemo: string;

  @Column('text', { nullable: true })
  revisionMemo: string;

  @Column({ type: 'jsonb', nullable: true })
  photoSnapshot: unknown;

  // 페르소나 정보 (어드민 배정)
  @Column('text', { nullable: true })
  personaSnapshot: string;

  @Column({ nullable: true })
  personaId: string;

  // 원고 정보
  @Column('text', { nullable: true })
  manuscript: string;

  @Column('text', { nullable: true })
  validationReport: string;

  @Column('text', { nullable: true })
  rejectionReason: string;

  @Column('text', { nullable: true })
  extraInstruction: string;

  // 타입별 확장 데이터 (예: RECEIPT_REVIEW payload)
  @Column({ type: 'jsonb', nullable: true })
  payload: unknown;

  @Column({ type: 'int', default: 0 })
  approveCount: number;

  @Column({ type: 'int', default: 0 })
  rejectCount: number;

  @Column({ type: 'int', default: 0 })
  revisionCount: number;

  @Column({ nullable: true })
  completedAt: Date;

  // Gemini 상태(한국어) 및 마지막 실패 사유
  @Column({ type: 'text', nullable: true })
  geminiStatusKo: string;

  @Column({ type: 'text', nullable: true })
  lastFailureReason: string;

  // 과금 단가(포인트) - 예약/차감 정합을 위해 주문 시점에 고정
  @Column({ type: 'int', default: 0 })
  unitPrice: number;

  // 결제/취소 관련 (운영 편의; nullable)
  @Column({ type: 'timestamp', nullable: true })
  chargedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelRequestedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  canceledAt: Date;

  @Column({ type: 'text', nullable: true })
  cancelReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}


