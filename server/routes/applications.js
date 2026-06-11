import express from "express";
import { body, param } from "express-validator";

import verifyToken from "../middleware/verifyToken.js";
import validateRequest from "../middleware/validateRequest.js";
import {
    createApplication,
    getApplicationById,
    getApplicationsByStudent,
    getTutorApplications,
    updateApplication,
    deleteApplication,
} from "../controllers/applicationController.js";

const router = express.Router();

router.post(
    "/",
    verifyToken,
    body("tuitionId").notEmpty(),
    validateRequest,
    createApplication,
);

router.get(
    "/student/:email",
    verifyToken,
    param("email").isEmail(),
    validateRequest,
    getApplicationsByStudent,
);

router.get(
    "/tutor/:email",
    verifyToken,
    param("email").isEmail(),
    validateRequest,
    getTutorApplications,
);

router.get(
    "/:id",
    verifyToken,
    param("id").isMongoId(),
    validateRequest,
    getApplicationById,
);

router.patch(
    "/:id",
    verifyToken,
    param("id").isMongoId(),
    validateRequest,
    updateApplication,
);

router.delete(
    "/:id",
    verifyToken,
    param("id").isMongoId(),
    validateRequest,
    deleteApplication,
);

export default router;
