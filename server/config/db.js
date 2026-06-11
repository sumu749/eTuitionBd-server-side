import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

dotenv.config();

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined in .env");
}

export const client = new MongoClient(mongoUri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

let connected = false;

export async function connectToMongo() {
    if (connected) {
        return client;
    }

    await client.connect();
    connected = true;
    console.log("MongoDB Connected (server/config/db.js)");
    return client;
}
