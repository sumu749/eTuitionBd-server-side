import admin from "firebase-admin";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

let serviceAccount;

// Prefer environment variable for Vercel deployment
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (error) {
        throw new Error(
            "Invalid FIREBASE_SERVICE_ACCOUNT_JSON: must be valid JSON",
        );
    }
} else {
    // Fallback to local file for local development
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const filePath = join(__dirname, "firebase-admin-key.json");

    try {
        serviceAccount = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (error) {
        throw new Error(
            "Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT_JSON env var or ensure firebase/firebase-admin-key.json exists locally",
        );
    }
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

export default admin;
