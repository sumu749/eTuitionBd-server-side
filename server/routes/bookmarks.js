import express from "express";
import { body, param } from "express-validator";

import verifyToken from "../middleware/verifyToken.js";
import validateRequest from "../middleware/validateRequest.js";
import {
    createBookmark,
    getBookmarks,
    getBookmarksByEmail,
    deleteBookmark,
    deleteBookmarkById,
} from "../controllers/bookmarkController.js";

const router = express.Router();

router.post(
    "/",
    verifyToken,
    body("tuitionId").notEmpty(),
    validateRequest,
    createBookmark,
);

router.get("/", verifyToken, getBookmarks);

router.delete("/", verifyToken, deleteBookmark);

router.get(
    "/:email",
    verifyToken,
    param("email").isEmail(),
    validateRequest,
    getBookmarksByEmail,
);

router.delete(
    "/:id",
    verifyToken,
    param("id").isMongoId(),
    validateRequest,
    deleteBookmarkById,
);

export default router;
