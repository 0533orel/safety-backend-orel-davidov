import {Router} from "express";
import {createEvent, deleteEvent, getEvents, updateEvent} from "../controllers/eventsController";
import {upload} from "../middleware/uploadMiddleware";

const router = Router();

router.post('/', upload.single('image'), createEvent)

router.get('/', getEvents)

router.delete('/:id', deleteEvent)

router.put('/:id', upload.single('image'), updateEvent)

export default router;