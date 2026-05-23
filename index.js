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

        const usersCollection = client.db("etuitionbdDB").collection("users");
        //  Create User API
        app.post("/users", async (req, res) => {
            const user = req.body;

            const existingUser = await usersCollection.findOne({
                email: user.email,
            });

            if (existingUser) {
                return res.send({
                    message: "user exists",
                });
            }

            const result = await usersCollection.insertOne(user);

            res.send(result);
        });

        // Get User by Email API

        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;

            const result = await usersCollection.findOne({
                email,
            });

            res.send(result);
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
