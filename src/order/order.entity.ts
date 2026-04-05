import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string;

  @Column({ type: 'json', nullable: true })
  shippingAddress?: any;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  /** Résumé paiement (ex. 4 derniers chiffres, titulaire) — jamais le numéro complet ni le CVV */
  @Column({ type: 'json', nullable: true })
  paymentMeta?: { cardLast4?: string; cardHolder?: string };

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items?: OrderItem[];
}
