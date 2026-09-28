import { parsePagination } from '../validation/pagination';
import { Request, Response, NextFunction } from 'express';
import { EventsService } from '../services/eventsService';
import { parseDeleteImage, parseEventInput } from '../validation/eventInput';
import { parseEventId } from '../httpError';
import { cleanupUpload } from '../config/uploads';
import { uploadDir } from '../config/uploads';
import { actor } from '../auth/session';
import { HttpError } from '../httpError';
import path from 'node:path';
export const createEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = parseEventInput(req.body);
        if (req.file) data.imagePath = req.file.filename;
        res.status(201).json(await EventsService.createNewEvent(data, actor(res)));
    } catch (error) { await cleanupUpload(req.file?.filename); next(error); }
};
export const updateEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseEventId(req.params.id);
        const data = parseEventInput(req.body);
        const deleteImage = parseDeleteImage(req.body.deleteImage);
        if (req.file) data.imagePath = req.file.filename;
        res.json(await EventsService.updateEvent(id, data, actor(res), deleteImage));
    } catch (error) { await cleanupUpload(req.file?.filename); next(error); }
};
export const getEvents = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { limit, cursor } = parsePagination(req.query);
        res.json(await EventsService.getAllEvents(actor(res), limit, cursor));
    } catch (error) { next(error); }
};
export const deleteEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await EventsService.deleteEvent(parseEventId(req.params.id), actor(res));
        res.status(204).end();
    } catch (error) { next(error); }
};
export const getEvent = async (req: Request, res: Response) => {
    res.json(await EventsService.getEvent(parseEventId(req.params.id), actor(res)));
};
export const getImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const event = await EventsService.getEvent(parseEventId(req.params.id), actor(res));
        const filename = event.imagePath;
        if (!filename || path.basename(filename) !== filename) throw new HttpError(404, 'Image not found');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.sendFile(filename, { root: uploadDir, dotfiles: 'deny', cacheControl: false }, error => {
            if (error && !res.headersSent) next(new HttpError(404, 'Image not found'));
        });
    } catch (error) { next(error); }
};
