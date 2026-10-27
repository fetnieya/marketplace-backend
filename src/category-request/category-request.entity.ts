import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

export enum CategoryRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('category_request')
export class CategoryRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sellerId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller?: User;

  @Column({ length: 255 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: CategoryRequestStatus,
    default: CategoryRequestStatus.PENDING,
  })
  status: CategoryRequestStatus;

  @CreateDateColumn()
  createdAt: Date;
}
