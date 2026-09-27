import {Router} from "express";
import {createEvent, deleteEvent, getEvents, updateEvent} from "../controllers/eventsController";
import {uploadImage} from "../middleware/uploadMiddleware";

const router = Router();

router.post('/', uploadImage, createEvent)

router.get('/', getEvents)

router.delete('/:id', deleteEvent)

router.put('/:id', uploadImage, updateEvent)

export default router;