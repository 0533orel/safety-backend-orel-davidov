import { AppDataSource } from '../config/database';
import { SafetyEventEntity } from '../entities/SafetyEventEntity';
import { cleanupUpload } from '../config/uploads';
import { HttpError } from '../httpError';
export class EventsService {
    static async createNewEvent(data: Partial<SafetyEventEntity>) {
        const repository = AppDataSource.getRepository(SafetyEventEntity);
        return repository.save(repository.create({ ...data, createdAt: Date.now() }));
    }
    static async getAllEvents(limit: number, cursor?: { createdAt: number; id: number }) {
        const query = AppDataSource.getRepository(SafetyEventEntity).createQueryBuilder('event')
            .orderBy('event.createdAt', 'DESC').addOrderBy('event.id', 'DESC').take(limit + 1);
        if (cursor) query.where('(event.createdAt < :createdAt OR (event.createdAt = :createdAt AND event.id < :id))', cursor);
        const rows = await query.getMany();
        const items = rows.slice(0, limit);
        const last = items[items.length - 1];
        return { items, nextCursor: rows.length > limit ? `${last.createdAt}:${last.id}` : null };
    }
    static async deleteEvent(id: number) {
        const image = await AppDataSource.transaction(async manager => {
            const repository = manager.getRepository(SafetyEventEntity);
            const event = await repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
            if (!event) throw new HttpError(404, 'Event not found');
            await repository.delete(id);
            return event.imagePath;
        });
        await cleanupUpload(image);
    }
    static async updateEvent(id: number, data: Partial<SafetyEventEntity>, deleteImage = false) {
        const result = await AppDataSource.transaction(async manager => {
            const repository = manager.getRepository(SafetyEventEntity);
            const event = await repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
            if (!event) throw new HttpError(404, 'Event not found');
            const oldImage = event.imagePath;
            repository.merge(event, data);
            if (deleteImage && !data.imagePath) event.imagePath = null;
            const saved = await repository.save(event);
            return { saved, obsolete: oldImage !== saved.imagePath ? oldImage : null };
        });
        await cleanupUpload(result.obsolete);
        return result.saved;
    }
}
