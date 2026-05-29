import { client } from "../db.js";

const verifyAdmin = async (req, res, next) => {
    try {
        const usersCollection = client.db("etuitionbdDB").collection("users");

        const user = await usersCollection.findOne({
            email: req.decoded.email,
        });

        if (!user || user.role !== "admin") {
            return res.status(403).send({
                message: "Forbidden Access",
            });
        }

        next();
    } catch (error) {
        res.status(500).send({
            message: "Admin verification failed",
        });
    }
};

export default verifyAdmin;
