import { Entity, Column, PrimaryColumn } from 'typeorm';
@Entity('auth_sessions')
export class SessionEntity {
    @PrimaryColumn('text') tokenHash!: string;
    @Column('integer') userId!: number;
    @Column('bigint', { transformer: { to: (v: number) => v, from: (v: string) => Number(v) } }) expiresAt!: number;
}
