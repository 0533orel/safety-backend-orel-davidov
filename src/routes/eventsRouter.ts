import {Router} from "express";
import {createEvent, deleteEvent, getEvents, updateEvent, getEvent, getImage} from "../controllers/eventsController";
import {uploadImage} from "../middleware/uploadMiddleware";
import { actor, authenticate, csrf, requireRole } from '../auth/session';
import { EventsService } from '../services/eventsService';
import { parseEventId } from '../httpError';

const router = Router();
router.use(authenticate, csrf);

router.post('/', uploadImage, createEvent)

router.get('/', getEvents)

router.get('/:id', getEvent)
router.get('/:id/image', getImage)
router.delete('/:id', requireRole('admin'), deleteEvent)

// Reject unauthorized writers before buffering or persisting an upload; the service rechecks under its row lock.
router.put('/:id', async (req, res, next) => {
    await EventsService.getEvent(parseEventId(req.params.id), actor(res)); next();
}, uploadImage, updateEvent)

export default router;
