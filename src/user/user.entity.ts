import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  SELLER = 'seller',
  CLIENT = 'client',
}

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ unique: true, nullable: true })
  cin?: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth?: Date;

  @Column({ type: 'longblob', nullable: true })
  photo?: Buffer;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CLIENT,
  })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
