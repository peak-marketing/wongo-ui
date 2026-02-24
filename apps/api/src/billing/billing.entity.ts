import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../user/user.entity';
import { Order } from '../order/order.entity';

@Entity('billing_transactions')
export class BillingTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ nullable: true })
  orderId: string;

  @Column()
  type:
    | 'RESERVE'
    | 'CAPTURE'
    | 'RELEASE'
    | 'TOPUP_REQUEST'
    | 'TOPUP_APPROVED'
    | 'ADJUST'
    | 'REFUND';

  // 모든 금액은 KRW 정수(원 단위)
  @Column('int')
  amount: number;

  @Column({ default: 'COMPLETED' })
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED';

  // 선택: 충전 요청/주문 등 참조 ID, 메모
  @Column({ nullable: true })
  topupRequestId?: string;

  @Column({ nullable: true })
  memo?: string;

  // 수량 (예: 주문 건수, 예약/사용/해제 건수)
  @Column('int', { default: 0 })
  units: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ unique: true })
  userId: string;

  // 보유 잔액(원)
  @Column('int', { default: 0 })
  balance: number;

  // 예약 금액(원)
  @Column('int', { default: 0 })
  reserved: number;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('topup_requests')
export class TopupRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column('int')
  amount: number; // 원 단위

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | 'EXPIRED';

  @Column({ nullable: true })
  memo?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}





