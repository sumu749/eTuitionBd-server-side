import jwt from "jsonwebtoken";
import admin from "../config/firebaseAdmin.js";
import { client } from "../config/db.js";

const usersCollection = client.db("etuitionbdDB").collection("users");
const accessLevels = {
    admin: 3,
    tutor: 2,
    student: 1,
};

export async function createJwt(req, res, next) {
    try {
        const { idToken } = req.body;
        const decoded = await admin.auth().verifyIdToken(idToken);
        const email = decoded.email;

        const user = await usersCollection.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const payload = {
            email: user.email,
            role: user.role,
            accessLevel: accessLevels[user.role] || 0,
            userId: user._id.toString(),
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });

        res.json({ success: true, token });
    } catch (error) {
        next(error);
    }
}

export async function refreshToken(req, res, next) {
    try {
        const { email } = req.body;
        const user = await usersCollection.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const payload = {
            email: user.email,
            role: user.role,
            accessLevel: accessLevels[user.role] || 0,
            userId: user._id.toString(),
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });

        res.json({ success: true, token });
    } catch (error) {
        next(error);
    }
}
