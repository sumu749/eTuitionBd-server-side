import { client } from "../config/db.js";

const usersCollection = client.db("etuitionbdDB").collection("users");
const tuitionsCollection = client.db("etuitionbdDB").collection("tuitions");
const applicationsCollection = client
    .db("etuitionbdDB")
    .collection("applications");

export async function getAdminStats(req, res, next) {
    try {
        const totalUsers = await usersCollection.countDocuments();
        const totalStudents = await usersCollection.countDocuments({
            role: "student",
        });
        const totalTutors = await usersCollection.countDocuments({
            role: "tutor",
        });
        const totalAdmins = await usersCollection.countDocuments({
            role: "admin",
        });
        const totalTuitions = await tuitionsCollection.countDocuments();
        const totalApplications = await applicationsCollection.countDocuments();

        const approvedApplications = await applicationsCollection
            .find({ status: "approved" })
            .toArray();

        const totalRevenue = approvedApplications.reduce(
            (sum, app) => sum + Number(app.expectedSalary || 0),
            0,
        );

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const newUsers = await usersCollection.countDocuments({
            createdAt: { $gte: startOfMonth },
        });

        const pendingReviews = await tuitionsCollection.countDocuments({
            status: "pending",
        });

        res.json({
            totalUsers,
            totalStudents,
            totalTutors,
            totalAdmins,
            totalTuitions,
            totalApplications,
            totalRevenue,
            newUsers,
            pendingReviews,
        });
    } catch (error) {
        next(error);
    }
}
