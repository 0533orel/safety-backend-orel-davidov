import {AppDataSource} from "../config/database";
import {SafetyEventEntity} from "../entities/SafetyEventEntity";
import fs from 'fs';
import path from 'path';

export class EventsService {

    static async createNewEvent(eventData: Partial<SafetyEventEntity>): Promise<SafetyEventEntity> {
        this.validateEventData(eventData)

        const eventRepository = AppDataSource.getRepository(SafetyEventEntity);
        const newEvent = eventRepository.create(eventData);
        return await eventRepository.save(newEvent);
    }

    static async getAllEvents(): Promise<SafetyEventEntity[]> {
        const eventRepository = AppDataSource.getRepository(SafetyEventEntity);
        return await eventRepository.find({
            order: {createdAt: "DESC"}
        });
    }

    static async deleteEvent(id: number): Promise<void> {
        const eventRepository = AppDataSource.getRepository(SafetyEventEntity);
        const eventToDelete = await eventRepository.findOneBy({ id });
        if (!eventToDelete) {
            throw new Error(`Event with id ${id} not found`);
        }

        if (eventToDelete.imagePath) {
            const filePath = path.join(__dirname, '../../uploads', eventToDelete.imagePath);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Deleted image file: ${filePath}`);
            }
        }

        await eventRepository.delete(id);
    }

    static async updateEvent(id: number, eventData: any): Promise<SafetyEventEntity | null> {
        this.validateEventData(eventData)

        const eventRepository = AppDataSource.getRepository(SafetyEventEntity);
        const eventToUpdate = await eventRepository.findOneBy({ id });
        if (!eventToUpdate) return null;

        if ((eventData.deleteImage === 'true' || eventData.imagePath) && eventToUpdate.imagePath) {
            const oldFilePath = path.join(__dirname, '../../uploads', eventToUpdate.imagePath);
            if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
                console.log(`Deleted old image: ${oldFilePath}`);
            }

            if (eventData.deleteImage === 'true' && !eventData.imagePath) {
                eventToUpdate.imagePath = null as any;
                eventData.imagePath = null;
            }
        }

        eventRepository.merge(eventToUpdate, eventData)
        return await eventRepository.save(eventToUpdate)
    }

    private static validateEventData(eventData: Partial<SafetyEventEntity>) {
        if (eventData.description && eventData.description.length > 800) {
            throw new Error("תיאור האירוע ארוך מדי (מקסימום 800 תווים)");
        }

        if (eventData.eventDate) {
            const eventDateTime = new Date(
                `${eventData.eventDate}T${eventData.eventTime || "00:00"}`
            );
            const now = new Date();

            if (eventDateTime > now) {
                throw new Error("לא ניתן לדווח על אירוע עתידי");
            }
        }
    }
}