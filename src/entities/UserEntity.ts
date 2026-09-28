import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
export type Role = 'reporter' | 'reviewer' | 'admin';
@Entity('auth_users')
export class UserEntity {
    @PrimaryGeneratedColumn() id!: number;
    @Column('text', { unique: true }) username!: string;
    @Column('text') passwordHash!: string;
    @Column('text') role!: Role;
    @Column('boolean', { default: true }) active!: boolean;
}
