import express from "express";
import { body, param, query } from "express-validator";

import verifyToken from "../middleware/verifyToken.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import validateRequest from "../middleware/validateRequest.js";
import {
    createPaymentIntent,
    saveTransaction,
    getAllTransactions,
    getTransactionById,
    getPaymentsByStudent,
    getRevenueForTutor,
} from "../controllers/paymentController.js";

const router = express.Router();

router.post(
    "/create-intent",
    verifyToken,
    body("amount").isFloat({ gt: 0 }),
    validateRequest,
    createPaymentIntent,
);

router.post(
    "/transactions",
    verifyToken,
    body("applicationId").notEmpty(),
    validateRequest,
    saveTransaction,
);

router.get("/transactions", verifyToken, verifyAdmin, getAllTransactions);

router.get(
    "/transactions/:id",
    verifyToken,
    param("id").isMongoId(),
    validateRequest,
    getTransactionById,
);

router.get(
    "/payments",
    verifyToken,
    query("email").isEmail(),
    validateRequest,
    getPaymentsByStudent,
);

router.get(
    "/revenue/:email",
    verifyToken,
    param("email").isEmail(),
    validateRequest,
    getRevenueForTutor,
);

export default router;
