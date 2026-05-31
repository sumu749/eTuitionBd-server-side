import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { ObjectId } from "mongodb";

import { client, connectToMongo } from "../db.js";

import verifyToken from "../middlewares/verifyToken.js";
import verifyFirebaseToken from "../middlewares/verifyFirebaseToken.js";
import verifyAdmin from "../middlewares/verifyAdmin.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Root Route
app.get("/", (req, res) => {
    res.send("eTuitionBd Server Running");
});

async function run() {
    try {
        await connectToMongo();

        console.log("MongoDB Connected Successfully");

        // Collections
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

        const reviewsCollection = client
            .db("etuitionbdDB")
            .collection("reviews");

        const bookmarksCollection = client
            .db("etuitionbdDB")
            .collection("bookmarks");

        // =========================================================
        // USERS APIs
        // =========================================================

        // Create User
        app.post("/users", async (req, res) => {
            try {
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
            } catch (error) {
                res.status(500).send({
                    success: false,
                    message: "Failed to create user",
                });
            }
        });

        // Public Tutors API
        app.get("/public-tutors", async (req, res) => {
            try {
                const { limit } = req.query;

                let cursor = usersCollection.find({
                    role: "tutor",
                });

                if (limit) {
                    cursor = cursor.limit(parseInt(limit));
                }

                const result = await cursor.toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load tutors",
                });
            }
        });

        // Get User Role
        app.get("/users/role/:email", async (req, res) => {
            try {
                const email = req.params.email;

                const user = await usersCollection.findOne({
                    email,
                });

                res.send({
                    role: user?.role || null,
                });
            } catch (error) {
                res.status(500).send({
                    message: "Failed to get role",
                });
            }
        });

        // Get Tutor By ID

        app.get("/users/tutor/:id", async (req, res) => {
            try {
                const id = req.params.id;

                const result = await usersCollection.findOne({
                    _id: new ObjectId(id),
                });

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load tutor",
                });
            }
        });

        // Get User By Email
        app.get("/users/:email", async (req, res) => {
            try {
                const email = req.params.email;

                const result = await usersCollection.findOne({
                    email,
                });

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to get user",
                });
            }
        });

        // Get All Users (Admin)
        app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
            try {
                const result = await usersCollection.find().toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to get users",
                });
            }
        });

        // Update User Role
        app.patch(
            "/users/role/:id",
            verifyToken,
            verifyAdmin,
            async (req, res) => {
                try {
                    const id = req.params.id;
                    const { role } = req.body;

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
                } catch (error) {
                    res.status(500).send({
                        message: "Failed to update role",
                    });
                }
            },
        );

        // Delete User
        app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
            try {
                const result = await usersCollection.deleteOne({
                    _id: new ObjectId(req.params.id),
                });

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to delete user",
                });
            }
        });

        // =========================================================
        // TUITIONS APIs
        // =========================================================

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

        // Get Approved Tuitions
        app.get("/approved-tuitions", async (req, res) => {
            try {
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

                // Filters
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

                if (sort === "oldest") {
                    sortOption = {
                        createdAt: 1,
                    };
                }

                const total = await tuitionsCollection.countDocuments(query);

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
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load tuitions",
                });
            }
        });

        // Get Tuition By ID
        app.get("/tuitions/:id", async (req, res) => {
            try {
                const id = req.params.id;

                const result = await tuitionsCollection.findOne({
                    _id: new ObjectId(id),
                });

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to get tuition",
                });
            }
        });

        // Get My Tuitions
        app.get("/my-tuitions/:email", verifyToken, async (req, res) => {
            try {
                const email = req.params.email;

                if (email !== req.decoded.email) {
                    return res.status(403).send({
                        message: "Forbidden Access",
                    });
                }

                const result = await tuitionsCollection
                    .find({
                        studentEmail: email,
                    })
                    .sort({
                        createdAt: -1,
                    })
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load tuitions",
                });
            }
        });

        // Update Tuition
        app.patch("/tuitions/:id", verifyToken, async (req, res) => {
            try {
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
            } catch (error) {
                res.status(500).send({
                    message: "Failed to update tuition",
                });
            }
        });

        // Delete Tuition
        app.delete("/tuitions/:id", verifyToken, async (req, res) => {
            try {
                const result = await tuitionsCollection.deleteOne({
                    _id: new ObjectId(req.params.id),
                });

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to delete tuition",
                });
            }
        });

        // Get All Tuitions (Admin)
        app.get("/tuitions", verifyToken, verifyAdmin, async (req, res) => {
            try {
                const result = await tuitionsCollection
                    .find()
                    .sort({
                        createdAt: -1,
                    })
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load admin tuitions",
                });
            }
        });

        // Update Tuition Status
        app.patch(
            "/tuitions/status/:id",
            verifyToken,
            verifyAdmin,
            async (req, res) => {
                try {
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
                } catch (error) {
                    res.status(500).send({
                        message: "Failed to update status",
                    });
                }
            },
        );

        // =========================================================
        // APPLICATION APIs
        // =========================================================

        // Create Application
        app.post("/applications", verifyToken, async (req, res) => {
            try {
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

                const result =
                    await applicationsCollection.insertOne(application);

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to apply",
                });
            }
        });

        // Get Applications By Student
        app.get("/applications/:email", verifyToken, async (req, res) => {
            try {
                const email = req.params.email;

                if (email !== req.decoded.email) {
                    return res.status(403).send({
                        message: "Forbidden Access",
                    });
                }

                const result = await applicationsCollection
                    .find({
                        studentEmail: email,
                    })
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load applications",
                });
            }
        });

        // Get Tutor Applications
        app.get("/tutor-applications/:email", verifyToken, async (req, res) => {
            try {
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
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load tutor applications",
                });
            }
        });

        // =========================================================
        // PAYMENTS APIs
        // =========================================================

        // Create Payment Intent
        app.post("/create-payment-intent", verifyToken, async (req, res) => {
            try {
                const { amount } = req.body;

                const paymentIntent = await stripe.paymentIntents.create({
                    amount: parseInt(amount * 100),
                    currency: "bdt",
                    payment_method_types: ["card"],
                });

                res.send({
                    clientSecret: paymentIntent.client_secret,
                });
            } catch (error) {
                res.status(500).send({
                    message: "Payment failed",
                });
            }
        });

        // Save Transaction
        app.post("/transactions", verifyToken, async (req, res) => {
            try {
                const result = await transactionsCollection.insertOne(req.body);

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to save transaction",
                });
            }
        });

        // Get Payments
        app.get("/payments", verifyToken, async (req, res) => {
            try {
                const email = req.query.email;

                if (email !== req.decoded.email) {
                    return res.status(403).send({
                        message: "Forbidden Access",
                    });
                }

                const result = await transactionsCollection
                    .find({
                        studentEmail: email,
                    })
                    .sort({
                        paymentDate: -1,
                    })
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load payments",
                });
            }
        });

        // =========================================================
        // REVIEWS APIs
        // =========================================================

        // Create Review
        app.post("/reviews", verifyToken, async (req, res) => {
            try {
                const result = await reviewsCollection.insertOne(req.body);

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to add review",
                });
            }
        });

        // Get Reviews
        app.get("/reviews/:email", async (req, res) => {
            try {
                const email = req.params.email;

                const result = await reviewsCollection
                    .find({
                        tutorEmail: email,
                    })
                    .sort({
                        createdAt: -1,
                    })
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load reviews",
                });
            }
        });

        // =========================================================
        // BOOKMARKS APIs
        // =========================================================

        // Create Bookmark

        app.post("/bookmarks", verifyToken, async (req, res) => {
            const bookmark = req.body;

            const existing = await bookmarksCollection.findOne({
                tuitionId: bookmark.tuitionId,

                tutorEmail: bookmark.tutorEmail,
            });

            if (existing) {
                return res.status(400).send({
                    message: "Already Bookmarked",
                });
            }

            const result = await bookmarksCollection.insertOne(bookmark);

            res.send(result);
        });

        // Get Bookmarks

        app.get("/bookmarks/:email", verifyToken, async (req, res) => {
            const email = req.params.email;

            const result = await bookmarksCollection
                .find({
                    tutorEmail: email,
                })
                .toArray();

            res.send(result);
        });

        // Delete Bookmark

        app.delete("/bookmarks/:id", verifyToken, async (req, res) => {
            const result = await bookmarksCollection.deleteOne({
                _id: new ObjectId(req.params.id),
            });

            res.send(result);
        });

        // =========================================================
        // ADMIN ANALYTICS
        // =========================================================

        app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
            try {
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
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load analytics",
                });
            }
        });

        // =========================================================
        // JWT APIs
        // =========================================================

        app.post("/jwt", verifyFirebaseToken, async (req, res) => {
            try {
                const email = req.decoded.email;

                const user = await usersCollection.findOne({
                    email,
                });

                if (!user) {
                    return res.status(404).send({
                        success: false,
                        message: "User not found",
                    });
                }

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
                };

                const token = jwt.sign(payload, process.env.JWT_SECRET, {
                    expiresIn: "7d",
                });

                res.send({
                    success: true,
                    token,
                });
            } catch (error) {
                res.status(500).send({
                    success: false,
                    message: "JWT failed",
                });
            }
        });

        // =========================================================
        // PRIVATE ROUTES
        // =========================================================

        app.get("/private", verifyToken, async (req, res) => {
            res.send({
                success: true,
                email: req.decoded.email,
            });
        });

        app.get("/firebase-private", verifyFirebaseToken, async (req, res) => {
            res.send({
                success: true,
                email: req.decoded.email,
            });
        });

        // if (!process.env.VERCEL) {
        //     app.listen(port, () => {
        //         console.log(`Server Running on Port ${port}`);
        //     });
        // }
    } catch (error) {
        console.error(error);
    }
}

run().catch(console.dir);

export default app;
