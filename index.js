import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { client, connectToMongo } from "./db.js";
import verifyFirebaseToken from "./middlewares/verifyFirebaseToken.js";
import verifyToken from "./middlewares/verifyToken.js";
import { ObjectId } from "mongodb";
import Stripe from "stripe";
import verifyAdmin from "./middlewares/verifyAdmin.js";

dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not defined in .env");
}

const stripe = new Stripe(stripeSecretKey);

const decoded = Buffer.from(
    process.env.FIREBASE_SERVICE_KEY,
    "base64",
).toString("utf8");
const serviceAccount = JSON.parse(decoded);

const app = express();
const port = process.env.PORT || 5000;
const dbName = process.env.DB_NAME || "etuitionbdDB";
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined in .env");
}

// Middleware
app.use(cors());
app.use(express.json());

// Root Route
app.get("/", (req, res) => {
    res.send("eTuitionBd Server Running");
});

// MongoDB

async function run() {
    try {
        await connectToMongo();

        const usersCollection = client.db("etuitionbdDB").collection("users");

        const tuitionsCollection = client
            .db("etuitionbdDB")
            .collection("tuitions");

        const applicationsCollection = client
            .db("etuitionbdDB")
            .collection("applications");

        const transactionsCollection = client
            .db("etuitionbdDB")
            .collection("transactions");

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
        app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
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

        // Tuitions APIs

        // Create Tuition

        app.post("/tuitions", verifyToken, async (req, res) => {
            try {
                const tuition = req.body;

                const result = await tuitionsCollection.insertOne(tuition);

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to create tuition",
                });
            }
        });

        // Get All Tuitions

        app.get("/my-tuitions/:email", verifyToken, async (req, res) => {
            const email = req.params.email;

            const result = await tuitionsCollection
                .find({
                    studentEmail: email,
                })
                .sort({
                    createdAt: -1,
                })
                .toArray();

            res.send(result);
        });

        // Delete Tuition

        app.delete("/tuitions/:id", verifyToken, async (req, res) => {
            const id = req.params.id;

            const result = await tuitionsCollection.deleteOne({
                _id: new ObjectId(id),
            });

            res.send(result);
        });

        // Update Tuition

        app.patch("/tuitions/:id", verifyToken, async (req, res) => {
            const id = req.params.id;

            const updatedData = req.body;

            const result = await tuitionsCollection.updateOne(
                {
                    _id: new ObjectId(id),
                },
                {
                    $set: updatedData,
                },
            );

            res.send(result);
        });

        // Applications APIs

        app.post("/applications", verifyToken, async (req, res) => {
            const application = req.body;

            const existing = await applicationsCollection.findOne({
                tuitionId: application.tuitionId,

                tutorEmail: application.tutorEmail,
            });

            if (existing) {
                return res.status(400).send({
                    message: "Already Applied",
                });
            }

            const result = await applicationsCollection.insertOne(application);

            res.send(result);
        });

        // Get Application By ID

        app.get("/application/:id", verifyToken, async (req, res) => {
            const result = await applicationsCollection.findOne({
                _id: new ObjectId(req.params.id),
            });

            res.send(result);
        });

        // Get Applications By Student Email

        app.get("/applications/:email", verifyToken, async (req, res) => {
            const email = req.params.email;

            const result = await applicationsCollection
                .find({
                    studentEmail: email,
                })
                .toArray();

            res.send(result);
        });

        // Update Application Status

        app.patch("/applications/:id", verifyToken, async (req, res) => {
            const id = req.params.id;

            const status = req.body.status;

            const result = await applicationsCollection.updateOne(
                {
                    _id: new ObjectId(id),
                },
                {
                    $set: {
                        status,
                    },
                },
            );

            res.send(result);
        });

        // Get All Approved Tuitions

        app.get("/approved-tuitions", async (req, res) => {
            const {
                searchParams,
                sort,
                page = 1,
                limit = 6,
                classLevel,
                subject,
                location,
            } = req.query;

            const currentPage = parseInt(page);
            const itemsPerPage = parseInt(limit);

            let query = {
                status: "approved",
            };

            // Search
            if (searchParams) {
                query.$or = [
                    {
                        subject: {
                            $regex: searchParams,
                            $options: "i",
                        },
                    },
                    {
                        location: {
                            $regex: searchParams,
                            $options: "i",
                        },
                    },
                ];
            }

            // Advanced Filters

            if (classLevel) {
                query.classLevel = classLevel;
            }

            if (subject) {
                query.subject = subject;
            }

            if (location) {
                query.location = location;
            }
            // Sort
            let sortOption = {
                createdAt: -1,
            };

            if (sort === "budget-low") {
                sortOption = {
                    budget: 1,
                };
            }

            if (sort === "budget-high") {
                sortOption = {
                    budget: -1,
                };
            }

            if (sort === "newest") {
                sortOption = {
                    createdAt: -1,
                };
            }

            if (sort === "oldest") {
                sortOption = {
                    createdAt: 1,
                };
            }

            // Total count
            const total = await tuitionsCollection.countDocuments(query);

            // Paginated data
            const result = await tuitionsCollection
                .find(query)
                .sort(sortOption)
                .skip((currentPage - 1) * itemsPerPage)
                .limit(itemsPerPage)
                .toArray();

            res.send({
                tuitions: result,
                totalPages: Math.ceil(total / itemsPerPage),
                currentPage,
            });
        });

        // Get Tuition By ID

        app.get("/tuitions/:id", async (req, res) => {
            const id = req.params.id;

            const result = await tuitionsCollection.findOne({
                _id: new ObjectId(id),
            });

            res.send(result);
        });

        // Get Applications By Tutor Email

        app.get("/tutor-applications/:email", verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({
                    message: "Forbidden Access",
                });
            }

            const result = await applicationsCollection
                .find({
                    tutorEmail: email,
                })
                .toArray();

            res.send(result);
        });

        // Check If Tutor Has Already Applied For A Tuition

        app.get("/check-application", verifyToken, async (req, res) => {
            const { tuitionId, email } = req.query;

            const existing = await applicationsCollection.findOne({
                tuitionId,
                tutorEmail: email,
            });

            res.send({
                applied: !!existing,
            });
        });

        // Delete Application

        app.delete("/applications/:id", verifyToken, async (req, res) => {
            const result = await applicationsCollection.deleteOne({
                _id: new ObjectId(req.params.id),
            });

            res.send(result);
        });

        // Get Ongoing Tuitions for Tutor

        app.get("/ongoing-tuitions/:email", verifyToken, async (req, res) => {
            const email = req.params.email;

            const result = await applicationsCollection
                .find({
                    tutorEmail: email,
                    status: "approved",
                })
                .toArray();

            res.send(result);
        });

        // Admin Update User Role

        app.patch(
            "/users/role/:id",
            verifyToken,
            verifyAdmin,
            async (req, res) => {
                const id = req.params.id;
                const role = req.body.role;

                const result = await usersCollection.updateOne(
                    {
                        _id: new ObjectId(id),
                    },
                    {
                        $set: {
                            role,
                        },
                    },
                );

                res.send(result);
            },
        );

        // Admin Delete User

        app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
            const result = await usersCollection.deleteOne({
                _id: new ObjectId(req.params.id),
            });

            res.send(result);
        });

        // Get All Tuitions (Admin)

        app.get("/tuitions", verifyToken, verifyAdmin, async (req, res) => {
            const result = await tuitionsCollection
                .find()
                .sort({ createdAt: -1 })
                .toArray();

            res.send(result);
        });

        // Admin Update Tuition Status

        app.patch(
            "/tuitions/status/:id",
            verifyToken,
            verifyAdmin,
            async (req, res) => {
                const id = req.params.id;
                const { status } = req.body;

                const result = await tuitionsCollection.updateOne(
                    {
                        _id: new ObjectId(id),
                    },
                    {
                        $set: {
                            status,
                        },
                    },
                );

                res.send(result);
            },
        );

        // Admin Analytics

        app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
            const totalUsers = await usersCollection.countDocuments();

            const totalStudents = await usersCollection.countDocuments({
                role: "student",
            });

            const totalTutors = await usersCollection.countDocuments({
                role: "tutor",
            });

            const totalAdmins = await usersCollection.countDocuments({
                role: "admin",
            });

            const totalTuitions = await tuitionsCollection.countDocuments();

            const totalApplications =
                await applicationsCollection.countDocuments();

            const approvedApplications = await applicationsCollection
                .find({
                    status: "approved",
                })
                .toArray();

            const totalRevenue = approvedApplications.reduce(
                (sum, app) => sum + Number(app.expectedSalary || 0),
                0,
            );

            res.send({
                totalUsers,
                totalStudents,
                totalTutors,
                totalAdmins,
                totalTuitions,
                totalApplications,
                totalRevenue,
            });
        });

        // Get Payments By Student Email

        app.get("/payments", verifyToken, async (req, res) => {
            const email = req.query.email;

            const result = await transactionsCollection
                .find({
                    studentEmail: email,
                })
                .sort({
                    paymentDate: -1,
                })
                .toArray();

            res.send(result);
        });

        // Create Payment Intent

        app.post("/create-payment-intent", verifyToken, async (req, res) => {
            const { amount } = req.body;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: parseInt(amount * 100),
                currency: "bdt",
                payment_method_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        // Transactions APIs

        app.get("/transactions", verifyToken, verifyAdmin, async (req, res) => {
            const result = await transactionsCollection
                .find()
                .sort({
                    paymentDate: -1,
                })
                .toArray();

            res.send(result);
        });

        // Create Transaction

        app.post("/transactions", verifyToken, async (req, res) => {
            const result = await transactionsCollection.insertOne(req.body);

            res.send(result);
        });

        // Get Transaction By ID

        app.get("/transactions/:id", verifyToken, async (req, res) => {
            const result = await transactionsCollection.findOne({
                _id: new ObjectId(req.params.id),
            });

            res.send(result);
        });

        // Get Revenue By Tutor Email

        app.get("/revenue/:email", verifyToken, async (req, res) => {
            const email = req.params.email;

            const result = await transactionsCollection
                .find({
                    tutorEmail: email,
                    status: "completed",
                })
                .sort({
                    paymentDate: -1,
                })
                .toArray();

            res.send(result);
        });

        // JWT API

        app.post("/jwt", async (req, res) => {
            try {
                const { email } = req.body;

                if (!email) {
                    return res.status(400).send({
                        success: false,
                        message: "Email is required",
                    });
                }

                // Fetch user role and details
                const user = await usersCollection.findOne({ email });

                if (!user) {
                    return res.status(404).send({
                        success: false,
                        message: "User not found",
                    });
                }

                // Determine access level based on role
                const accessLevels = {
                    admin: 3,
                    tutor: 2,
                    student: 1,
                };

                const accessLevel = accessLevels[user.role] || 0;

                const payload = {
                    email: user.email,
                    role: user.role,
                    accessLevel,
                    userId: user._id.toString(),
                    issuedAt: Math.floor(Date.now() / 1000),
                };

                const token = jwt.sign(payload, process.env.JWT_SECRET, {
                    expiresIn: "7d",
                });

                res.send({
                    success: true,
                    token,
                    user: {
                        email: user.email,
                        role: user.role,
                        accessLevel,
                    },
                });
            } catch (error) {
                console.error("JWT creation error:", error);
                res.status(500).send({
                    success: false,
                    message: "Failed to create JWT",
                });
            }
        });

        // Protected Test Route

        app.get("/firebase-private", verifyFirebaseToken, async (req, res) => {
            res.send({
                success: true,
                email: req.decoded.email,
            });
        });

        app.get("/private", verifyToken, async (req, res) => {
            res.send({
                success: true,
                email: req.decoded.email,
            });
        });

        app.listen(port, () => {
            console.log(`eTuitionBd Server Running on Port ${port}`);
        });
    } catch (error) {
        console.error("MongoDB Connection Error:", error);
        process.exit(1);
    }
}

run().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
