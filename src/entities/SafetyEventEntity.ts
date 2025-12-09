import {Entity, Column, PrimaryGeneratedColumn} from "typeorm";

@Entity("safety_events")
export class SafetyEventEntity {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column("bigint")
    createdAt!: number;

    @Column("text")
    unitName!: string;

    @Column("text")
    description!: string;

    @Column("text")
    eventDate!: string;

    @Column("text")
    eventTime!: string;

    @Column("text")
    location!: string;

    @Column("text")
    result!: string;

    @Column("text", { nullable: true })
    injurySeverity!: string;

    @Column("text")
    unitActivity!: string;

    @Column("text")
    personalActivity!: string;

    @Column("text")
    category!: string;

    @Column("text")
    weather!: string;

    @Column("text")
    eventSeverity!: string;

    @Column("text", { nullable: true })
    recommendations!: string;

    @Column("text", { nullable: true })
    coordinates!: string;
}