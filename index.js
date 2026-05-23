import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;

const mongoUri = process.env.MONGODB_URI;

const client = new MongoClient(mongoUri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");

        app.get("/", (req, res) => {
            res.send("eTuitionBd Server Running");
        });

        app.listen(port, () => {
            console.log(`Server running on ${port}`);
        });
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
        process.exit(1);
    }
}

run()
    .then(() => {
        app.listen(port, () => {
            console.log(
                `eTuitionBd Server is running on http://localhost:${port}`,
            );
        });
    })
    .catch((error) => {
        console.error("Failed to start server:", error);
        process.exit(1);
    });
