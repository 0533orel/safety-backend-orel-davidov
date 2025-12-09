import {Router} from "express";
import {createEvent, deleteEvent, getEvents} from "../controllers/eventsController";

const router = Router();

router.post('/', createEvent)

router.get('/', getEvents)

router.delete('/:id', deleteEvent)

export default router;