import { AppDataSource } from '../config/database';
import { SafetyEventEntity } from '../entities/SafetyEventEntity';
import { cleanupUpload } from '../config/uploads';
import { HttpError } from '../httpError';
import { UserEntity } from '../entities/UserEntity';
export function assertEventAccess(event: SafetyEventEntity, user: UserEntity) {
    if (user.role === 'reporter' && event.ownerId !== user.id) throw new HttpError(403, 'Forbidden');
}
export class EventsService {
    static async createNewEvent(data: Partial<SafetyEventEntity>, user: UserEntity) {
        const repository = AppDataSource.getRepository(SafetyEventEntity);
        return repository.save(repository.create({ ...data, ownerId: user.id, createdAt: Date.now() }));
    }
    static async getAllEvents(user: UserEntity, limit: number, cursor?: { createdAt: number; id: number }) {
        const query = AppDataSource.getRepository(SafetyEventEntity).createQueryBuilder('event')
            .orderBy('event.createdAt', 'DESC').addOrderBy('event.id', 'DESC').take(limit + 1);
        if (cursor) query.where('(event.createdAt < :createdAt OR (event.createdAt = :createdAt AND event.id < :id))', cursor);
        if (user.role === 'reporter') query.andWhere('event.ownerId = :ownerId', { ownerId: user.id });
        const rows = await query.getMany();
        const items = rows.slice(0, limit);
        const last = items[items.length - 1];
        return { items, nextCursor: rows.length > limit ? `${last.createdAt}:${last.id}` : null };
    }
    static async getEvent(id: number, user: UserEntity) {
        const event = await AppDataSource.getRepository(SafetyEventEntity).findOneBy({ id });
        if (!event) throw new HttpError(404, 'Event not found');
        assertEventAccess(event, user);
        return event;
    }
    static async deleteEvent(id: number, user: UserEntity) {
        if (user.role !== 'admin') throw new HttpError(403, 'Forbidden');
        const image = await AppDataSource.transaction(async manager => {
            const repository = manager.getRepository(SafetyEventEntity);
            const event = await repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
            if (!event) throw new HttpError(404, 'Event not found');
            await repository.delete(id);
            return event.imagePath;
        });
        await cleanupUpload(image);
    }
    static async updateEvent(id: number, data: Partial<SafetyEventEntity>, user: UserEntity, deleteImage = false) {
        const result = await AppDataSource.transaction(async manager => {
            const repository = manager.getRepository(SafetyEventEntity);
            const event = await repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
            if (!event) throw new HttpError(404, 'Event not found');
            assertEventAccess(event, user);
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
