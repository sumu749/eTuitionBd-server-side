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
        // req.decoded is already set by verifyFirebaseToken middleware
        const email = req.decoded?.email;

        if (!email) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: email not found in token",
            });
        }

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
        let email;

        // Try to verify an existing JWT from Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.slice(7);
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET, {
                    ignoreExpiration: true,
                });
                email = decoded.email;
            } catch (err) {
                // invalid token — we'll try Firebase idToken next
            }
        }

        // If no email yet, try Firebase idToken from body (`idToken`)
        if (!email) {
            const idToken = req.body?.idToken || req.body?.firebaseIdToken;
            if (idToken) {
                try {
                    const decoded = await admin.auth().verifyIdToken(idToken);
                    email = decoded.email;
                } catch (err) {
                    // invalid firebase token
                }
            }
        }

        if (!email) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: no valid token provided to refresh",
            });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) {
            return res
                .status(404)
                .json({ success: false, message: "User not found" });
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
