import express from "express";
import { body, param } from "express-validator";

import { client } from "../config/db.js";
import verifyToken from "../middleware/verifyToken.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import validateRequest from "../middleware/validateRequest.js";
import {
    createUser,
    getAllUsers,
    getUserRole,
    getTutorById,
    getUserByEmail,
    updateUserProfile,
    updateUserRole,
    deleteUser,
} from "../controllers/userController.js";

const usersCollection = client.db("etuitionbdDB").collection("users");

const router = express.Router();

router.post(
    "/",
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
    body("role").optional().isIn(["admin", "tutor", "student"]),
    validateRequest,
    createUser,
);

router.get("/", verifyToken, verifyAdmin, getAllUsers);

router.get("/public-tutors", async (req, res, next) => {
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
        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.get(
    "/role/:email",
    param("email").isEmail(),
    validateRequest,
    getUserRole,
);

router.get(
    "/tutor/:id",
    param("id").isMongoId(),
    validateRequest,
    getTutorById,
);

router.get(
    "/:email",
    param("email").isEmail(),
    validateRequest,
    getUserByEmail,
);

router.patch(
    "/profile/:email",
    verifyToken,
    param("email").isEmail(),
    validateRequest,
    updateUserProfile,
);

router.patch(
    "/role/:id",
    verifyToken,
    verifyAdmin,
    param("id").isMongoId(),
    body("role").isIn(["admin", "tutor", "student"]),
    validateRequest,
    updateUserRole,
);

router.delete(
    "/:id",
    verifyToken,
    verifyAdmin,
    param("id").isMongoId(),
    validateRequest,
    deleteUser,
);

export default router;
