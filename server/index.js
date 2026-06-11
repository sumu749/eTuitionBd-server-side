import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

import { connectToMongo } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import tuitionRoutes from "./routes/tuitions.js";
import applicationRoutes from "./routes/applications.js";
import paymentRoutes from "./routes/payments.js";
import reviewRoutes from "./routes/reviews.js";
import bookmarkRoutes from "./routes/bookmarks.js";
import adminRoutes from "./routes/admin.js";
import errorHandler from "./middleware/errorHandler.js";
import verifyToken from "./middleware/verifyToken.js";
import verifyFirebaseToken from "./middleware/verifyFirebaseToken.js";

// Controllers used for legacy endpoint aliases
import {
    getApprovedTuitions,
    getOngoingTuitions,
} from "./controllers/tuitionController.js";
import {
    getApplicationById,
    getTutorApplications,
} from "./controllers/applicationController.js";
import { getPublicTutors } from "./controllers/userController.js";
import { getRevenueForTutor } from "./controllers/paymentController.js";
import { createJwt, refreshToken } from "./controllers/authController.js";
import { getAdminStats } from "./controllers/adminController.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
});

app.use(
    cors({
        origin: true,
        methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);
app.options(/.*/, cors());
app.use(express.json());

app.use("/auth", authLimiter, authRoutes);
// Use the less-restrictive API limiter for user routes to avoid frequent 429s
// caused by frontend polling (role checks, profile lookups, etc.).
app.use("/users", apiLimiter, userRoutes);
app.use("/tuitions", apiLimiter, tuitionRoutes);
app.use("/applications", apiLimiter, applicationRoutes);
app.use("/payments", apiLimiter, paymentRoutes);
app.use("/reviews", apiLimiter, reviewRoutes);
app.use("/bookmarks", apiLimiter, bookmarkRoutes);
app.use("/admin", apiLimiter, adminRoutes);
app.use(apiLimiter);

// Legacy endpoint aliases (keeps backward compatibility with old clients)
app.get("/approved-tuitions", apiLimiter, getApprovedTuitions);
app.get(
    "/ongoing-tuitions/:email",
    apiLimiter,
    verifyToken,
    getOngoingTuitions,
);
app.get("/application/:id", apiLimiter, verifyToken, getApplicationById);
app.get("/public-tutors", apiLimiter, getPublicTutors);
app.get(
    "/tutor-applications/:email",
    apiLimiter,
    verifyToken,
    getTutorApplications,
);
app.get("/revenue/:email", apiLimiter, verifyToken, getRevenueForTutor);

app.post("/jwt", authLimiter, verifyFirebaseToken, createJwt);
app.post("/refresh-token", authLimiter, verifyToken, refreshToken);

app.get("/admin-stats", apiLimiter, verifyToken, async (req, res, next) => {
    // delegate to new controller
    return getAdminStats(req, res, next);
});

app.get("/private", verifyToken, (req, res) => {
    res.json({ success: true, email: req.decoded?.email });
});

app.get("/firebase-private", verifyFirebaseToken, (req, res) => {
    res.json({ success: true, email: req.decoded?.email });
});

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "eTuitionBd Server Running",
    });
});

app.use(errorHandler);

async function startServer() {
    await connectToMongo();

    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}

if (!process.env.VERCEL) {
    startServer().catch((error) => {
        console.error("Failed to start server:", error);
        process.exit(1);
    });
}

export default app;
