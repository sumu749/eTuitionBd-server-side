import express from "express";
import { body, param } from "express-validator";

import verifyToken from "../middleware/verifyToken.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import validateRequest from "../middleware/validateRequest.js";
import {
    getApprovedTuitions,
    createTuition,
    getTuitionById,
    getMyTuitions,
    updateTuition,
    deleteTuition,
    getAllTuitions,
    updateTuitionStatus,
    getOngoingTuitions,
} from "../controllers/tuitionController.js";

const router = express.Router();

router.get("/approved", getApprovedTuitions);

router.get("/ongoing/:email", verifyToken, getOngoingTuitions);

router.get("/", verifyToken, verifyAdmin, getAllTuitions);

router.post(
    "/",
    verifyToken,
    body("subject").notEmpty(),
    validateRequest,
    createTuition,
);

router.get("/my-tuitions/:email", verifyToken, getMyTuitions);

// Specific named routes must come before parameterized routes like `/:id`
// to avoid accidental capture of named paths (e.g. "my-tuitions").
router.get("/:id", getTuitionById);

router.patch(
    "/:id",
    verifyToken,
    body("subject").optional().notEmpty(),
    validateRequest,
    updateTuition,
);

router.patch(
    "/status/:id",
    verifyToken,
    verifyAdmin,
    param("id").isMongoId(),
    body("status").isIn(["approved", "pending", "rejected"]),
    validateRequest,
    updateTuitionStatus,
);

router.delete("/:id", verifyToken, deleteTuition);

export default router;
