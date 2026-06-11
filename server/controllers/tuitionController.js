import { ObjectId } from "mongodb";
import { client } from "../config/db.js";
import { hydrateApplications } from "../utils/hydrateApplications.js";

const tuitionsCollection = client.db("etuitionbdDB").collection("tuitions");

export async function getApprovedTuitions(req, res, next) {
    try {
        const {
            searchParams,
            sort,
            page = 1,
            limit = 6,
            classLevel,
            subject,
            location,
        } = req.query;

        const currentPage = parseInt(page, 10);
        const itemsPerPage = parseInt(limit, 10);
        const query = { status: "approved" };

        if (searchParams) {
            query.$or = [
                { subject: { $regex: searchParams, $options: "i" } },
                { location: { $regex: searchParams, $options: "i" } },
            ];
        }

        if (classLevel) {
            query.classLevel = classLevel;
        }

        if (subject) {
            query.subject = subject;
        }

        if (location) {
            query.location = location;
        }

        const total = await tuitionsCollection.countDocuments(query);
        const result = await tuitionsCollection
            .find(query)
            .sort(
                sort === "budget-low"
                    ? { budget: 1 }
                    : sort === "budget-high"
                      ? { budget: -1 }
                      : sort === "oldest"
                        ? { createdAt: 1 }
                        : { createdAt: -1 },
            )
            .skip((currentPage - 1) * itemsPerPage)
            .limit(itemsPerPage)
            .toArray();

        res.json({
            tuitions: result,
            totalPages: Math.ceil(total / itemsPerPage),
            currentPage,
        });
    } catch (error) {
        next(error);
    }
}

export async function createTuition(req, res, next) {
    try {
        const tuition = req.body;
        const result = await tuitionsCollection.insertOne(tuition);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
}

export async function getTuitionById(req, res, next) {
    try {
        const tuition = await tuitionsCollection.findOne({
            _id: new ObjectId(req.params.id),
        });

        if (!tuition) {
            return res.status(404).json({ message: "Tuition not found" });
        }

        res.json(tuition);
    } catch (error) {
        next(error);
    }
}

export async function getMyTuitions(req, res, next) {
    try {
        const email = req.params.email;
        if (email !== req.decoded.email) {
            return res.status(403).json({ message: "Forbidden Access" });
        }

        const result = await tuitionsCollection
            .find({ studentEmail: email })
            .sort({ createdAt: -1 })
            .toArray();

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function updateTuition(req, res, next) {
    try {
        const id = req.params.id;
        const tuition = await tuitionsCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!tuition) {
            return res.status(404).json({ message: "Tuition not found" });
        }

        if (tuition.studentEmail !== req.decoded.email) {
            return res.status(403).json({
                message:
                    "Forbidden: You do not have permission to edit this tuition",
            });
        }

        const result = await tuitionsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: req.body },
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function deleteTuition(req, res, next) {
    try {
        const id = req.params.id;
        const tuition = await tuitionsCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!tuition) {
            return res.status(404).json({ message: "Tuition not found" });
        }

        if (tuition.studentEmail !== req.decoded.email) {
            return res.status(403).json({
                message:
                    "Forbidden: You do not have permission to delete this tuition",
            });
        }

        const result = await tuitionsCollection.deleteOne({
            _id: new ObjectId(id),
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function getAllTuitions(req, res, next) {
    try {
        const result = await tuitionsCollection
            .find()
            .sort({ createdAt: -1 })
            .toArray();
        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function updateTuitionStatus(req, res, next) {
    try {
        const id = req.params.id;
        const { status } = req.body;

        const result = await tuitionsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status } },
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function getOngoingTuitions(req, res, next) {
    try {
        const email = req.params.email;
        if (email !== req.decoded.email) {
            return res.status(403).json({ message: "Forbidden Access" });
        }

        const applicationsCollection = client
            .db("etuitionbdDB")
            .collection("applications");
        const applications = await applicationsCollection
            .find({ tutorEmail: email, status: "approved" })
            .sort({ appliedAt: -1 })
            .toArray();

        const result = await hydrateApplications(
            applications,
            client.db("etuitionbdDB").collection("users"),
            tuitionsCollection,
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}
