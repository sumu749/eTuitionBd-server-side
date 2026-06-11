import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const serviceKey = process.env.FIREBASE_SERVICE_KEY;

if (!serviceKey) {
    throw new Error("FIREBASE_SERVICE_KEY missing");
}

let serviceAccount;

try {
    serviceAccount = JSON.parse(
        Buffer.from(serviceKey, "base64").toString("utf8"),
    );
} catch (error) {
    throw new Error("Invalid FIREBASE_SERVICE_KEY");
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

export default admin;
