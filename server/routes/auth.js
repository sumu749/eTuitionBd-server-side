import express from "express";
import { body } from "express-validator";

import validateRequest from "../middleware/validateRequest.js";
import { createJwt, refreshToken } from "../controllers/authController.js";

const router = express.Router();

router.post("/jwt", body("idToken").notEmpty(), validateRequest, createJwt);

router.post(
    "/refresh-token",
    body("email").isEmail(),
    validateRequest,
    refreshToken,
);

export default router;
