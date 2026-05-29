import admin from "firebase-admin";

let serviceAccount;

if (process.env.FIREBASE_SERVICE_KEY) {
    try {
        const decoded = Buffer.from(
            process.env.FIREBASE_SERVICE_KEY,
            "base64",
        ).toString("utf8");

        serviceAccount = JSON.parse(decoded);
    } catch (error) {
        throw new Error("Invalid FIREBASE_SERVICE_KEY");
    }
} else {
    throw new Error("FIREBASE_SERVICE_KEY missing");
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

export default admin;
