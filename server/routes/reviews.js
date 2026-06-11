import express from "express";
import { body, param } from "express-validator";

import verifyToken from "../middleware/verifyToken.js";
import validateRequest from "../middleware/validateRequest.js";
import {
    createReview,
    getReviewsForTutor,
} from "../controllers/reviewController.js";

const router = express.Router();

router.post(
    "/",
    verifyToken,
    body("tutorEmail").isEmail(),
    body("rating").isInt({ min: 1, max: 5 }),
    validateRequest,
    createReview,
);

router.get(
    "/:email",
    param("email").isEmail(),
    validateRequest,
    getReviewsForTutor,
);

export default router;
