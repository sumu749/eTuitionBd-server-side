import { client } from "../db.js";

const verifyAdmin = async (req, res, next) => {
    try {
        // Fast path: check if token has admin accessLevel (3)
        if (req.decoded.accessLevel && req.decoded.accessLevel >= 3) {
            return next();
        }

        // Fallback: verify from database in case role changed since token issued
        const usersCollection = client.db("etuitionbdDB").collection("users");

        const user = await usersCollection.findOne({
            email: req.decoded.email,
        });

        if (!user || user.role !== "admin") {
            return res.status(403).send({
                success: false,
                message: "Forbidden: Admin access required",
            });
        }

        next();
    } catch (error) {
        console.error("Admin verification error:", error);
        res.status(500).send({
            success: false,
            message: "Admin verification failed",
        });
    }
};

export default verifyAdmin;
