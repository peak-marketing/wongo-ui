import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../user/user.entity';

@Entity('order_templates')
export class OrderTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'agencyId' })
  agency: User;

  @Column()
  agencyId: string;

  @Column()
  placeName: string;

  @Column({ nullable: true })
  placeNameNormalized: string;

  @Column('json')
  templateData: {
    address?: string;
    searchKeywords?: string[];
    includeText?: string;
    requiredKeywords?: string[];
    emphasizeKeywords?: string[];
    link?: boolean;
    map?: boolean;
    hashtag?: boolean;
    hashtags?: string[];
    referenceText?: string;
    notes?: string;
  };

  @CreateDateColumn()
  createdAt: Date;
}




