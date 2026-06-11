import express from "express";

import verifyToken from "../middleware/verifyToken.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import { getAdminStats } from "../controllers/adminController.js";

const router = express.Router();

router.get("/stats", verifyToken, verifyAdmin, getAdminStats);

export default router;
