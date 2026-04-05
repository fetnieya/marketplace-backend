import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Category } from '../category/category.entity';
import { User } from '../user/user.entity';
import { Image } from '../image/image.entity';

export enum ProductStatus {
  DISPONIBLE = 'disponible',
  EN_ATTENTE = 'en_attente',
  VENDU = 'vendu',
}

@Entity('product')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  discount?: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.DISPONIBLE,
  })
  status: ProductStatus;

  @OneToMany(() => Image, (image) => image.product, { cascade: true })
  images?: Image[];

  @Column({ nullable: true })
  image?: string; // Image principale (première image du tableau, pour compatibilité)

  @Column({ nullable: true })
  video?: string;

  @Column({ type: 'int' })
  sellerId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sellerId' })
  seller?: User;

  @Column({ type: 'int' })
  categoryId: number;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'categoryId' })
  category?: Category;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** JSON array of floats for RAG similarity (OpenAI embeddings); excluded from default selects */
  @Column({ type: 'longtext', nullable: true, select: false })
  embeddingJson?: string | null;
}