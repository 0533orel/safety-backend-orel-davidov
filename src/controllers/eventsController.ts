import {Request, Response} from "express";
import {EventsService} from "../services/eventsService";

export const createEvent = async (req: Request, res: Response) => {
    try {
        const eventData = req.body;

        const savedEvent = await EventsService.createNewEvent(eventData)

        res.status(201).json(savedEvent);
    } catch (error) {
        console.error("Error creating event:", error)
        res.status(500).json({message: 'Failed to create event'})
    }
}

export const getEvents = async (req: Request, res: Response) => {
    try {
        const events = await EventsService.getAllEvents();
        res.status(200).json(events)
    } catch (error) {
        console.error('Error fetching events:', error)
        res.status(500).json({message: "Failed to fetch events"})
    }
}

export const deleteEvent = async (req: Request, res: Response) => {
    try{
        const {id} = req.params;

        const numericId = parseInt(id, 10);

        if (isNaN(numericId)) {
            res.status(400).json({ message: "Invalid ID format" });
            return;
        }

        await EventsService.deleteEvent(numericId)

        res.status(200).json({message: 'Event deleted successfully'})
    } catch (error){
        console.error('Error deleting event:', error)
        res.status(500).json({message: 'Failed to delete event'})
    }
}