import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { ObjectId } from "mongodb";
import rateLimit from "express-rate-limit";

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

let usersCollection;
let tuitionsCollection;
let applicationsCollection;
let transactionsCollection;
let reviewsCollection;
let bookmarksCollection;
let collectionsReady = false;
let resolveDbReady;
const dbReadyPromise = new Promise((resolve) => {
    resolveDbReady = resolve;
});

const dbReady = async (req, res, next) => {
    if (!collectionsReady) {
        await dbReadyPromise;
    }
    next();
};

// Rate limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { message: "Too many requests, please try again later" },
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
});

// Apply rate limiters
app.use("/jwt", authLimiter);
app.use("/users", authLimiter);
app.use(apiLimiter); // global fallback

// Root Route
app.get("/", (req, res) => {
    res.send("eTuitionBd Server Running");
});

app.use(dbReady);

// Known public routes are registered immediately so they can't return 404 while the DB is initializing.
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

        const query = {
            status: "approved",
        };

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

        if (classLevel) {
            query.classLevel = classLevel;
        }

        if (subject) {
            query.subject = subject;
        }

        if (location) {
            query.location = location;
        }

        const total = await tuitionsCollection.countDocuments(query);

        const result = await tuitionsCollection
            .find(query)
            .sort(
                sort === "budget-low"
                    ? { budget: 1 }
                    : sort === "budget-high"
                      ? { budget: -1 }
                      : sort === "oldest"
                        ? { createdAt: 1 }
                        : { createdAt: -1 },
            )
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

app.get("/bookmarks", verifyToken, async (req, res) => {
    const email = req.query.email;

    if (!email) {
        return res.status(400).send({
            message: "email query parameter is required",
        });
    }

    const result = await bookmarksCollection
        .find({ tutorEmail: email })
        .toArray();

    res.send(result);
});

app.get("/bookmarks/:email", verifyToken, async (req, res) => {
    const email = req.params.email;

    const result = await bookmarksCollection
        .find({ tutorEmail: email })
        .toArray();

    res.send(result);
});

const getDocumentById = async (collection, id) => {
    try {
        return await collection.findOne({ _id: new ObjectId(id) });
    } catch {
        return null;
    }
};

const userPublicProjection = {
    name: 1,
    email: 1,
    photoURL: 1,
    subject: 1,
    university: 1,
    bio: 1,
    location: 1,
    role: 1,
};

const tuitionPublicProjection = {
    _id: 1,
    subject: 1,
    classLevel: 1,
    budget: 1,
    location: 1,
    status: 1,
    studentEmail: 1,
    createdAt: 1,
};

const hydrateApplications = async (applications) => {
    if (!Array.isArray(applications) || applications.length === 0) {
        return [];
    }

    const userEmails = new Set();
    const tuitionIds = new Set();

    applications.forEach((application) => {
        if (application.studentEmail) {
            userEmails.add(application.studentEmail);
        }
        if (application.tutorEmail) {
            userEmails.add(application.tutorEmail);
        }
        if (application.tuitionId) {
            tuitionIds.add(application.tuitionId.toString());
        }
    });

    const users = await usersCollection
        .find({ email: { $in: [...userEmails] } })
        .project(userPublicProjection)
        .toArray();

    const userMap = users.reduce((acc, user) => {
        acc[user.email] = user;
        return acc;
    }, {});

    const validTuitionObjectIds = [...tuitionIds].reduce((acc, id) => {
        try {
            acc.push(new ObjectId(id));
        } catch {
            // ignore invalid tuition IDs
        }
        return acc;
    }, []);

    const tuitions = await tuitionsCollection
        .find({ _id: { $in: validTuitionObjectIds } })
        .project(tuitionPublicProjection)
        .toArray();

    const tuitionMap = tuitions.reduce((acc, tuition) => {
        acc[tuition._id.toString()] = tuition;
        return acc;
    }, {});

    return applications.map((application) => ({
        ...application,
        student: userMap[application.studentEmail] || null,
        tutor: userMap[application.tutorEmail] || null,
        tuition: tuitionMap[application.tuitionId?.toString()] || null,
    }));
};

async function run() {
    try {
        await connectToMongo();

        console.log("MongoDB Connected Successfully");

        // Collections
        usersCollection = client.db("etuitionbdDB").collection("users");

        tuitionsCollection = client.db("etuitionbdDB").collection("tuitions");

        applicationsCollection = client
            .db("etuitionbdDB")
            .collection("applications");

        transactionsCollection = client
            .db("etuitionbdDB")
            .collection("transactions");

        reviewsCollection = client.db("etuitionbdDB").collection("reviews");

        bookmarksCollection = client.db("etuitionbdDB").collection("bookmarks");

        const normalizeIndexKey = (key) =>
            Object.entries(key)
                .map(([field, order]) => `${field}:${order}`)
                .join(",");

        async function ensureIndex(collection, key, options = {}) {
            const desiredKey = normalizeIndexKey(key);
            const existingIndexes = await collection.indexes();

            const matchingIndex = existingIndexes.find(
                (index) => normalizeIndexKey(index.key) === desiredKey,
            );

            if (matchingIndex) {
                if (options.unique && !matchingIndex.unique) {
                    console.warn(
                        `Index on ${collection.collectionName}(${desiredKey}) already exists without unique constraint. Skipping unique creation.`,
                    );
                }
                return;
            }

            await collection.createIndex(key, options);
        }

        async function createIndexes() {
            await ensureIndex(usersCollection, { email: 1 }, { unique: true });
            await ensureIndex(usersCollection, { role: 1 });
            await ensureIndex(tuitionsCollection, { studentEmail: 1 });
            await ensureIndex(tuitionsCollection, { status: 1 });
            await ensureIndex(tuitionsCollection, { status: 1, createdAt: -1 });
            await ensureIndex(applicationsCollection, { tutorEmail: 1 });
            await ensureIndex(applicationsCollection, { studentEmail: 1 });
            await ensureIndex(
                applicationsCollection,
                { tuitionId: 1, tutorEmail: 1 },
                { unique: true },
            );
            await ensureIndex(transactionsCollection, { studentEmail: 1 });
            await ensureIndex(transactionsCollection, { tutorEmail: 1 });
            await ensureIndex(reviewsCollection, { tutorEmail: 1 });
            await ensureIndex(
                reviewsCollection,
                { tutorEmail: 1, studentEmail: 1 },
                { unique: true },
            );
            await ensureIndex(bookmarksCollection, { tutorEmail: 1 });
            await ensureIndex(
                bookmarksCollection,
                { tuitionId: 1, tutorEmail: 1 },
                { unique: true },
            );
        }

        collectionsReady = true;
        if (resolveDbReady) {
            resolveDbReady();
        }
        console.log("Collections ready and service is now accepting requests");

        createIndexes().catch((error) => {
            console.error("Failed to create indexes:", error);
        });

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

                const result = await usersCollection
                    .find({ role: "tutor" })
                    .project({
                        name: 1,
                        email: 1,
                        photoURL: 1,
                        subject: 1,
                        university: 1,
                        bio: 1,
                        location: 1,
                        role: 1,
                    })
                    .limit(parseInt(limit) || 50)
                    .toArray();

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

                const result = await usersCollection.findOne(
                    { email },
                    { projection: { password: 0 } },
                );

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
                const result = await usersCollection
                    .find()
                    .project({ password: 0 })
                    .toArray();

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
                    .find({ studentEmail: email })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load tuitions",
                });
            }
        });

        // Update Tuition
        // FIXED: Added ownership check — only the student who created this
        // tuition can update it. Fetch first, compare studentEmail, then update.
        app.patch("/tuitions/:id", verifyToken, async (req, res) => {
            try {
                const id = req.params.id;

                // Step 1: Fetch the tuition document
                const tuition = await getDocumentById(tuitionsCollection, id);

                // Step 2: Document must exist
                if (!tuition) {
                    return res.status(404).send({
                        message: "Tuition not found",
                    });
                }

                // Step 3: Only the student who owns this tuition can edit it
                if (tuition.studentEmail !== req.decoded.email) {
                    return res.status(403).send({
                        message:
                            "Forbidden: You do not have permission to edit this tuition",
                    });
                }

                // Step 4: Ownership confirmed — proceed with update
                const updatedData = req.body;

                const result = await tuitionsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedData },
                );

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to update tuition",
                });
            }
        });

        // Delete Tuition
        // FIXED: Added ownership check — only the student who created this
        // tuition can delete it. Admins use a separate admin route.
        app.delete("/tuitions/:id", verifyToken, async (req, res) => {
            try {
                const id = req.params.id;

                // Step 1: Fetch the tuition document
                const tuition = await getDocumentById(tuitionsCollection, id);

                // Step 2: Document must exist
                if (!tuition) {
                    return res.status(404).send({
                        message: "Tuition not found",
                    });
                }

                // Step 3: Only the student who owns this tuition can delete it
                if (tuition.studentEmail !== req.decoded.email) {
                    return res.status(403).send({
                        message:
                            "Forbidden: You do not have permission to delete this tuition",
                    });
                }

                // Step 4: Ownership confirmed — proceed with delete
                const result = await tuitionsCollection.deleteOne({
                    _id: new ObjectId(id),
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
                    .sort({ createdAt: -1 })
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load admin tuitions",
                });
            }
        });

        // Update Tuition Status (Admin only)
        app.patch(
            "/tuitions/status/:id",
            verifyToken,
            verifyAdmin,
            async (req, res) => {
                try {
                    const id = req.params.id;
                    const { status } = req.body;

                    const result = await tuitionsCollection.updateOne(
                        { _id: new ObjectId(id) },
                        { $set: { status } },
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
                const {
                    tuitionId,
                    qualifications,
                    experience,
                    expectedSalary,
                } = req.body;
                const tutorEmail = req.decoded.email;

                if (!tuitionId) {
                    return res.status(400).send({
                        message: "tuitionId is required",
                    });
                }

                let tuition;
                try {
                    tuition = await tuitionsCollection.findOne({
                        _id: new ObjectId(tuitionId),
                    });
                } catch {
                    return res.status(400).send({
                        message: "Invalid tuitionId",
                    });
                }

                if (!tuition) {
                    return res.status(404).send({
                        message: "Tuition not found",
                    });
                }

                const studentEmail = tuition.studentEmail;

                if (studentEmail === tutorEmail) {
                    return res.status(400).send({
                        message: "You cannot apply to your own tuition",
                    });
                }

                const existing = await applicationsCollection.findOne({
                    tuitionId: tuitionId.toString(),
                    tutorEmail,
                });

                if (existing) {
                    return res.status(400).send({
                        message: "Already Applied",
                    });
                }

                const application = {
                    tuitionId: tuitionId.toString(),
                    studentEmail,
                    tutorEmail,
                    qualifications,
                    experience,
                    expectedSalary,
                    status: "pending",
                    appliedAt: new Date(),
                };

                const result =
                    await applicationsCollection.insertOne(application);

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to apply",
                });
            }
        });

        // Get Single Application by ID (used by Checkout page)
        app.get("/application/:id", verifyToken, async (req, res) => {
            try {
                const id = req.params.id;

                const application = await getDocumentById(
                    applicationsCollection,
                    id,
                );

                if (!application) {
                    return res.status(404).send({
                        message: "Application not found",
                    });
                }

                // Only the student who owns this tuition or the tutor who applied
                // can view a single application detail
                const requesterEmail = req.decoded.email;

                if (
                    application.studentEmail !== requesterEmail &&
                    application.tutorEmail !== requesterEmail
                ) {
                    return res.status(403).send({
                        message: "Forbidden Access",
                    });
                }

                const [hydrated] = await hydrateApplications([application]);

                res.send(hydrated);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load application",
                });
            }
        });

        // Get Applications By Student Email
        app.get("/applications/:email", verifyToken, async (req, res) => {
            try {
                const email = req.params.email;

                if (email !== req.decoded.email) {
                    return res.status(403).send({
                        message: "Forbidden Access",
                    });
                }

                const applications = await applicationsCollection
                    .find({ studentEmail: email })
                    .sort({ appliedAt: -1 })
                    .toArray();

                const result = await hydrateApplications(applications);

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load applications",
                });
            }
        });

        // Get Tutor Applications By Tutor Email
        app.get("/tutor-applications/:email", verifyToken, async (req, res) => {
            try {
                const email = req.params.email;

                if (email !== req.decoded.email) {
                    return res.status(403).send({
                        message: "Forbidden Access",
                    });
                }

                const applications = await applicationsCollection
                    .find({ tutorEmail: email })
                    .sort({ appliedAt: -1 })
                    .toArray();

                const result = await hydrateApplications(applications);

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load tutor applications",
                });
            }
        });

        // Update Application
        // FIXED: Role-aware ownership split.
        //
        // Two actors use this route for different purposes:
        //
        // ACTOR A — Tutor editing their own pending application content:
        //   Allowed fields: qualifications, experience, expectedSalary
        //   Ownership check: application.tutorEmail === req.decoded.email
        //
        // ACTOR B — Student approving or rejecting an application on their tuition:
        //   Allowed fields: status
        //   Ownership check: application.studentEmail === req.decoded.email
        //
        // Any other combination returns 403.
        app.patch("/applications/:id", verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const updatePayload = req.body;
                const requesterEmail = req.decoded.email;

                // Step 1: Fetch the application document
                const application = await getDocumentById(
                    applicationsCollection,
                    id,
                );

                // Step 2: Document must exist
                if (!application) {
                    return res.status(404).send({
                        message: "Application not found",
                    });
                }

                // Step 3: Determine which actor is making this request
                // and enforce the correct ownership rule.

                const isStatusUpdate =
                    "status" in updatePayload &&
                    Object.keys(updatePayload).length === 1;

                const isContentUpdate =
                    !isStatusUpdate &&
                    (updatePayload.qualifications !== undefined ||
                        updatePayload.experience !== undefined ||
                        updatePayload.expectedSalary !== undefined);

                if (isStatusUpdate) {
                    // Only the student who owns the parent tuition can
                    // approve or reject an application
                    if (application.studentEmail !== requesterEmail) {
                        return res.status(403).send({
                            message:
                                "Forbidden: Only the student who posted this tuition can approve or reject applications",
                        });
                    }

                    if (updatePayload.status === "approved") {
                        return res.status(400).send({
                            message:
                                "Applications can only be approved through the payment flow",
                        });
                    }

                    // Validate that the status value is one of the allowed values
                    const allowedStatuses = ["approved", "rejected", "pending"];
                    if (!allowedStatuses.includes(updatePayload.status)) {
                        return res.status(400).send({
                            message: "Invalid status value",
                        });
                    }
                } else if (isContentUpdate) {
                    // Only the tutor who submitted this application can
                    // edit its content, and only while it is still pending
                    if (application.tutorEmail !== requesterEmail) {
                        return res.status(403).send({
                            message:
                                "Forbidden: You can only edit your own application",
                        });
                    }

                    if (application.status !== "pending") {
                        return res.status(400).send({
                            message:
                                "Cannot edit an application that has already been reviewed",
                        });
                    }

                    // Whitelist only the fields a tutor is allowed to change.
                    // This prevents a tutor from injecting other fields
                    // like studentEmail or tuitionId into the update.
                    const allowedFields = [
                        "qualifications",
                        "experience",
                        "expectedSalary",
                    ];

                    const sanitizedPayload = {};
                    for (const field of allowedFields) {
                        if (updatePayload[field] !== undefined) {
                            sanitizedPayload[field] = updatePayload[field];
                        }
                    }

                    // Replace the full updatePayload with the sanitized version
                    Object.keys(updatePayload).forEach(
                        (k) => delete updatePayload[k],
                    );
                    Object.assign(updatePayload, sanitizedPayload);
                } else {
                    // The request body doesn't match either expected pattern —
                    // reject it entirely
                    return res.status(400).send({
                        message: "Invalid update payload",
                    });
                }

                // Step 4: Ownership and validation confirmed — proceed
                const result = await applicationsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatePayload },
                );

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to update application",
                });
            }
        });

        // Delete Application
        // FIXED: Only the tutor who submitted this application can delete it.
        // Students cannot delete tutor applications — they can only reject them
        // via the status update route above.
        app.delete("/applications/:id", verifyToken, async (req, res) => {
            try {
                const id = req.params.id;

                // Step 1: Fetch the application document
                const application = await getDocumentById(
                    applicationsCollection,
                    id,
                );

                // Step 2: Document must exist
                if (!application) {
                    return res.status(404).send({
                        message: "Application not found",
                    });
                }

                // Step 3: Only the tutor who owns this application can delete it
                if (application.tutorEmail !== req.decoded.email) {
                    return res.status(403).send({
                        message:
                            "Forbidden: You can only delete your own application",
                    });
                }

                // Step 4: Ownership confirmed — proceed with delete
                const result = await applicationsCollection.deleteOne({
                    _id: new ObjectId(id),
                });

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to delete application",
                });
            }
        });

        // =========================================================
        // ONGOING TUITIONS API
        // =========================================================

        // Get Ongoing Tuitions for a Tutor
        // Returns all applications with status "approved" for this tutor.
        // This was previously missing — fixes the 404 on TutorDashboard
        // and OngoingApplications pages.
        app.get("/ongoing-tuitions/:email", verifyToken, async (req, res) => {
            try {
                const email = req.params.email;

                if (email !== req.decoded.email) {
                    return res.status(403).send({
                        message: "Forbidden Access",
                    });
                }

                const applications = await applicationsCollection
                    .find({
                        tutorEmail: email,
                        status: "approved",
                    })
                    .sort({ appliedAt: -1 })
                    .toArray();

                const result = await hydrateApplications(applications);

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load ongoing tuitions",
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
                    currency: "usd",
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
                const txData = req.body;

                // Verify the application belongs to this student
                const application = await applicationsCollection.findOne({
                    _id: new ObjectId(txData.applicationId),
                    studentEmail: req.decoded.email,
                });

                if (!application) {
                    return res.status(403).send({ message: "Forbidden" });
                }

                const session = client.startSession();

                let result;

                await session.withTransaction(async () => {
                    const txResult = await transactionsCollection.insertOne(
                        txData,
                        { session },
                    );

                    await applicationsCollection.updateOne(
                        { _id: application._id },
                        { $set: { status: "approved" } },
                        { session },
                    );

                    result = txResult;
                });

                await session.endSession();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to save transaction",
                });
            }
        });

        // Get All Transactions (Admin)
        app.get("/transactions", verifyToken, verifyAdmin, async (req, res) => {
            try {
                const result = await transactionsCollection
                    .find()
                    .sort({ paymentDate: -1 })
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load transactions",
                });
            }
        });

        // Get Transaction Details
        app.get("/transactions/:id", verifyToken, async (req, res) => {
            try {
                const id = req.params.id;

                const transaction = await transactionsCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!transaction) {
                    return res.status(404).send({
                        message: "Transaction not found",
                    });
                }

                const requesterEmail = req.decoded.email;
                const isAdmin = req.decoded.accessLevel >= 3;

                if (
                    !isAdmin &&
                    requesterEmail !== transaction.studentEmail &&
                    requesterEmail !== transaction.tutorEmail
                ) {
                    return res.status(403).send({
                        message: "Forbidden Access",
                    });
                }

                res.send(transaction);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load transaction details",
                });
            }
        });

        // Get Payments for a Student
        app.get("/payments", verifyToken, async (req, res) => {
            try {
                const email = req.query.email;

                if (email !== req.decoded.email) {
                    return res.status(403).send({
                        message: "Forbidden Access",
                    });
                }

                const result = await transactionsCollection
                    .find({ studentEmail: email })
                    .sort({ paymentDate: -1 })
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load payments",
                });
            }
        });

        // Get Revenue for a Tutor
        // Was previously missing — fixes the 404 on Revenue page.
        app.get("/revenue/:email", verifyToken, async (req, res) => {
            try {
                const email = req.params.email;

                if (email !== req.decoded.email) {
                    return res.status(403).send({
                        message: "Forbidden Access",
                    });
                }

                const result = await transactionsCollection
                    .find({ tutorEmail: email })
                    .sort({ paymentDate: -1 })
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to load revenue",
                });
            }
        });

        // =========================================================
        // REVIEWS APIs
        // =========================================================

        // Create Review
        // FIXED: Added duplicate review check — a student can only review
        // a tutor once. Prevents rating manipulation.
        app.post("/reviews", verifyToken, async (req, res) => {
            try {
                const reviewData = req.body;

                // Prevent duplicate reviews from the same student
                const existing = await reviewsCollection.findOne({
                    tutorEmail: reviewData.tutorEmail,
                    studentEmail: req.decoded.email,
                });

                if (existing) {
                    return res.status(400).send({
                        message:
                            "You have already reviewed this tutor. You can only submit one review per tutor.",
                    });
                }

                // Ensure the review is submitted as the authenticated user,
                // not as a spoofed identity
                reviewData.studentEmail = req.decoded.email;

                const result = await reviewsCollection.insertOne(reviewData);

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to add review",
                });
            }
        });

        // Get Reviews for a Tutor
        app.get("/reviews/:email", async (req, res) => {
            try {
                const email = req.params.email;

                const result = await reviewsCollection
                    .find({ tutorEmail: email })
                    .sort({ createdAt: -1 })
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
            try {
                const data = req.body;

                // Accept tuitionId from either field
                const tuitionId = data.tuitionId || data._id || data.id;

                if (!tuitionId) {
                    return res.status(400).send({
                        success: false,
                        message: "tuitionId is required",
                    });
                }

                const tutorEmail = req.decoded.email;
                const bookmark = {
                    ...data,
                    tuitionId: tuitionId.toString(),
                    tutorEmail,
                    bookmarkedAt: new Date(),
                };

                const existing = await bookmarksCollection.findOne({
                    tuitionId: bookmark.tuitionId,
                    tutorEmail,
                });

                if (existing) {
                    return res.status(200).send({
                        success: true,
                        message: "Already Bookmarked",
                        _id: existing._id,
                    });
                }

                const result = await bookmarksCollection.insertOne(bookmark);

                res.status(201).send({
                    success: true,
                    _id: result.insertedId,
                });
            } catch (error) {
                console.error("Bookmark creation error:", error);
                res.status(500).send({
                    success: false,
                    message: "Failed to create bookmark",
                });
            }
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
                    .find({ status: "approved" })
                    .toArray();

                const totalRevenue = approvedApplications.reduce(
                    (sum, app) => sum + Number(app.expectedSalary || 0),
                    0,
                );

                // Calculate new users this month
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                const newUsers = await usersCollection.countDocuments({
                    createdAt: { $gte: startOfMonth },
                });

                // Pending reviews = tuitions still waiting for admin approval
                const pendingReviews = await tuitionsCollection.countDocuments({
                    status: "pending",
                });

                res.send({
                    totalUsers,
                    totalStudents,
                    totalTutors,
                    totalAdmins,
                    totalTuitions,
                    totalApplications,
                    totalRevenue,
                    newUsers,
                    pendingReviews,
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

                const user = await usersCollection.findOne({ email });

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

        // Refresh JWT — issues a new token with updated user info in case their role or other details have changed since the last token was issued. Requires a valid existing token to prevent abuse.

        app.post("/refresh-token", verifyToken, async (req, res) => {
            try {
                const user = await usersCollection.findOne({
                    email: req.decoded.email,
                });

                if (!user)
                    return res.status(404).send({ message: "User not found" });

                const accessLevels = { admin: 3, tutor: 2, student: 1 };
                const payload = {
                    email: user.email,
                    role: user.role,
                    accessLevel: accessLevels[user.role] || 0,
                    userId: user._id.toString(),
                };

                const token = jwt.sign(payload, process.env.JWT_SECRET, {
                    expiresIn: "7d",
                });

                res.send({ success: true, token });
            } catch {
                res.status(500).send({ message: "Refresh failed" });
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
    } catch (error) {
        console.error(error);
    }
}

run().catch(console.dir);

export default app;
