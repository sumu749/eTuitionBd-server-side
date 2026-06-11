import { client } from "../config/db.js";

const verifyAdmin = async (req, res, next) => {
    try {
        const accessLevel = req.decoded?.accessLevel;

        if (accessLevel >= 3) {
            return next();
        }

        const usersCollection = client.db("etuitionbdDB").collection("users");
        const user = await usersCollection.findOne({
            email: req.decoded.email,
        });

        if (!user || user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Forbidden: Admin access required",
            });
        }

        next();
    } catch (error) {
        next(error);
    }
};

export default verifyAdmin;
