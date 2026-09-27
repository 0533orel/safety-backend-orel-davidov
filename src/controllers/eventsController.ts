import { Request, Response, NextFunction } from 'express';
import { EventsService } from '../services/eventsService';
import { parseDeleteImage, parseEventInput } from '../validation/eventInput';
import { parseEventId } from '../httpError';
import { cleanupUpload } from '../config/uploads';
export const createEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = parseEventInput(req.body);
        if (req.file) data.imagePath = req.file.filename;
        res.status(201).json(await EventsService.createNewEvent(data));
    } catch (error) { await cleanupUpload(req.file?.filename); next(error); }
};
export const updateEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseEventId(req.params.id);
        const data = parseEventInput(req.body);
        const deleteImage = parseDeleteImage(req.body.deleteImage);
        if (req.file) data.imagePath = req.file.filename;
        res.json(await EventsService.updateEvent(id, data, deleteImage));
    } catch (error) { await cleanupUpload(req.file?.filename); next(error); }
};
export const getEvents = async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json(await EventsService.getAllEvents()); } catch (error) { next(error); }
};
export const deleteEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await EventsService.deleteEvent(parseEventId(req.params.id));
        res.status(204).end();
    } catch (error) { next(error); }
};
