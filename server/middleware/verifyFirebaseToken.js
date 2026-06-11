import admin from "../config/firebaseAdmin.js";

const verifyFirebaseToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: No valid authorization header provided",
            });
        }

        const idToken = authHeader.slice(7);
        const decoded = await admin.auth().verifyIdToken(idToken);
        req.decoded = decoded;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: "Unauthorized: Invalid Firebase token",
        });
    }
};

export default verifyFirebaseToken;
