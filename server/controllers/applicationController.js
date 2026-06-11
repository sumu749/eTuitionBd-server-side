import { ObjectId } from "mongodb";
import { client } from "../config/db.js";
import { hydrateApplications } from "../utils/hydrateApplications.js";

const applicationsCollection = client
    .db("etuitionbdDB")
    .collection("applications");
const usersCollection = client.db("etuitionbdDB").collection("users");
const tuitionsCollection = client.db("etuitionbdDB").collection("tuitions");

export async function createApplication(req, res, next) {
    try {
        const { tuitionId, qualifications, experience, expectedSalary } =
            req.body;
        const tutorEmail = req.decoded.email;

        if (!tuitionId) {
            return res.status(400).json({ message: "tuitionId is required" });
        }

        let tuition;
        try {
            tuition = await tuitionsCollection.findOne({
                _id: new ObjectId(tuitionId),
            });
        } catch {
            return res.status(400).json({ message: "Invalid tuitionId" });
        }

        if (!tuition) {
            return res.status(404).json({ message: "Tuition not found" });
        }

        const studentEmail = tuition.studentEmail;

        if (studentEmail === tutorEmail) {
            return res.status(400).json({
                message: "You cannot apply to your own tuition",
            });
        }

        const existing = await applicationsCollection.findOne({
            tuitionId: tuitionId.toString(),
            tutorEmail,
        });

        if (existing) {
            return res.status(400).json({ message: "Already Applied" });
        }

        const application = {
            tuitionId: tuitionId.toString(),
            studentEmail,
            tutorEmail,
            qualifications,
            experience,
            expectedSalary,
            status: "pending",
            appliedAt: new Date(),
        };

        const result = await applicationsCollection.insertOne(application);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
}

export async function getApplicationById(req, res, next) {
    try {
        const { id } = req.params;
        const application = await applicationsCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!application) {
            return res.status(404).json({ message: "Application not found" });
        }

        const requesterEmail = req.decoded.email;
        if (
            application.studentEmail !== requesterEmail &&
            application.tutorEmail !== requesterEmail
        ) {
            return res.status(403).json({ message: "Forbidden Access" });
        }

        const [hydrated] = await hydrateApplications(
            [application],
            usersCollection,
            tuitionsCollection,
        );

        res.json(hydrated);
    } catch (error) {
        next(error);
    }
}

export async function getApplicationsByStudent(req, res, next) {
    try {
        const { email } = req.params;
        if (email !== req.decoded.email) {
            return res.status(403).json({ message: "Forbidden Access" });
        }

        const applications = await applicationsCollection
            .find({ studentEmail: email })
            .sort({ appliedAt: -1 })
            .toArray();

        const result = await hydrateApplications(
            applications,
            usersCollection,
            tuitionsCollection,
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function getTutorApplications(req, res, next) {
    try {
        const { email } = req.params;
        if (email !== req.decoded.email) {
            return res.status(403).json({ message: "Forbidden Access" });
        }

        const applications = await applicationsCollection
            .find({ tutorEmail: email })
            .sort({ appliedAt: -1 })
            .toArray();

        const result = await hydrateApplications(
            applications,
            usersCollection,
            tuitionsCollection,
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function updateApplication(req, res, next) {
    try {
        const { id } = req.params;
        const updatePayload = req.body;
        const requesterEmail = req.decoded.email;

        const application = await applicationsCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!application) {
            return res.status(404).json({ message: "Application not found" });
        }

        const isStatusUpdate =
            "status" in updatePayload &&
            Object.keys(updatePayload).length === 1;

        const isContentUpdate =
            !isStatusUpdate &&
            (updatePayload.qualifications !== undefined ||
                updatePayload.experience !== undefined ||
                updatePayload.expectedSalary !== undefined);

        if (isStatusUpdate) {
            if (application.studentEmail !== requesterEmail) {
                return res.status(403).json({
                    message:
                        "Forbidden: Only the student who posted this tuition can approve or reject applications",
                });
            }

            const allowedStatuses = ["approved", "rejected", "pending"];
            if (!allowedStatuses.includes(updatePayload.status)) {
                return res
                    .status(400)
                    .json({ message: "Invalid status value" });
            }
        } else if (isContentUpdate) {
            if (application.tutorEmail !== requesterEmail) {
                return res.status(403).json({
                    message:
                        "Forbidden: You can only edit your own application",
                });
            }

            if (application.status !== "pending") {
                return res.status(400).json({
                    message:
                        "Cannot edit an application that has already been reviewed",
                });
            }

            const allowedFields = [
                "qualifications",
                "experience",
                "expectedSalary",
            ];
            const sanitizedPayload = {};
            for (const field of allowedFields) {
                if (updatePayload[field] !== undefined) {
                    sanitizedPayload[field] = updatePayload[field];
                }
            }
            Object.keys(updatePayload).forEach((k) => delete updatePayload[k]);
            Object.assign(updatePayload, sanitizedPayload);
        } else {
            return res.status(400).json({ message: "Invalid update payload" });
        }

        const result = await applicationsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updatePayload },
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function deleteApplication(req, res, next) {
    try {
        const { id } = req.params;
        const application = await applicationsCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!application) {
            return res.status(404).json({ message: "Application not found" });
        }

        if (application.tutorEmail !== req.decoded.email) {
            return res.status(403).json({
                message: "Forbidden: You can only delete your own application",
            });
        }

        const result = await applicationsCollection.deleteOne({
            _id: new ObjectId(id),
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
}
