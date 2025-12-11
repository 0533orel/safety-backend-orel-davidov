import "reflect-metadata";
import express from 'express';
import cors from 'cors'
import dotnet from 'dotenv'
import {AppDataSource} from "./config/database";
import eventsRouter from "./routes/eventsRouter";
import path from "path";

dotnet.config()

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors())
app.use(express.json())
app.use('/api/events', eventsRouter)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

AppDataSource.initialize()
    .then(() => {
        console.log(`database connected successfully`)

        app.listen(PORT, () => {
            console.log(`server is running on port ${PORT}`)
        })
    })
    .catch((error) => {
        console.error(`Error connecting to the database`, error)
    })

app.get('/', (req, res) => {
    res.send(`Safety System Backend is Active & Connected!`)
})