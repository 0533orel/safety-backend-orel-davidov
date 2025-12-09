import {AppDataSource} from "../config/database";
import {SafetyEventEntity} from "../entities/SafetyEventEntity";

export class EventsService {

    static async createNewEvent(eventData: Partial<SafetyEventEntity>): Promise<SafetyEventEntity> {
        if (eventData.description && eventData.description.length > 800) {
            throw new Error("תיאור האירוע ארוך מדי (מקסימום 800 תווים)")
        }

        if (eventData.eventDate){
            const timeString = eventData.eventTime || "00:00"
            const eventDataTime = new Date(`${eventData.eventDate}T${eventData.eventTime}`)
            const now = new Date()
            if(eventDataTime > now){
                throw new Error("לא ניתן לדווח על אירוע עתידי")
            }
        }

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
        const eventRepository = AppDataSource.getRepository(SafetyEventEntity)

        await eventRepository.delete(id)
    }
}