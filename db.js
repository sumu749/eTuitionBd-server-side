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

export async function connectToMongo() {
    try {
        await client.connect();

        await client.db("admin").command({
            ping: 1,
        });

        console.log("MongoDB Connected Successfully (db.js)");
    } catch (error) {
        console.error("MongoDB Connection Error (db.js):", error);
        throw error;
    }
}
