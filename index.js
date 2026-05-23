import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Root Route
app.get("/", (req, res) => {
    res.send("eTuitionBd Server Running");
});

// MongoDB
const client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

// JWT Middleware
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({
            success: false,
            message: "Unauthorized Access",
        });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error) {
            return res.status(401).send({
                success: false,
                message: "Invalid Token",
            });
        }

        req.decoded = decoded;
        next();
    });
};

async function run() {
    try {
        await client.connect();

        await client.db("admin").command({
            ping: 1,
        });

        console.log("MongoDB Connected Successfully");

        const usersCollection = client.db("etuitionbdDB").collection("users");

        // Users APIs

        // Create User
        app.post("/users", async (req, res) => {
            const user = req.body;

            const existingUser = await usersCollection.findOne({
                email: user.email,
            });

            if (existingUser) {
                return res.status(200).send({
                    success: false,
                    message: "User already exists",
                });
            }

            const result = await usersCollection.insertOne(user);

            res.status(201).send({
                success: true,
                result,
            });
        });

        // Get All Users
        app.get("/users", async (req, res) => {
            const result = await usersCollection.find().toArray();

            res.send(result);
        });

        // Get User By Email
        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;

            const result = await usersCollection.findOne({
                email,
            });

            res.send(result);
        });

        // Get User Role
        app.get("/users/role/:email", async (req, res) => {
            const email = req.params.email;

            const user = await usersCollection.findOne({
                email,
            });

            res.send({
                role: user?.role || null,
            });
        });

        // JWT API

        app.post("/jwt", async (req, res) => {
            const { email } = req.body;

            const token = jwt.sign({ email }, process.env.JWT_SECRET, {
                expiresIn: "7d",
            });

            res.send({ token });
        });

        // Protected Test Route

        app.get("/private", verifyToken, async (req, res) => {
            res.send({
                success: true,
                email: req.decoded.email,
            });
        });
    } catch (error) {
        console.error("MongoDB Connection Error:", error);
    }
}

run();

// Start Server
app.listen(port, () => {
    console.log(`eTuitionBd Server Running on Port ${port}`);
});
