import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import { client } from "../config/db.js";

const usersCollection = client.db("etuitionbdDB").collection("users");

export async function hashPassword(password) {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
}

export async function createUser(req, res, next) {
    try {
        const user = req.body;

        if (user.password) {
            user.password = await hashPassword(user.password);
        }

        user.role = user.role || "student";
        user.createdAt = new Date();

        const existingUser = await usersCollection.findOne({
            email: user.email,
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists",
            });
        }

        const result = await usersCollection.insertOne(user);

        res.status(201).json({
            success: true,
            userId: result.insertedId,
        });
    } catch (error) {
        next(error);
    }
}

export async function getAllUsers(req, res, next) {
    try {
        const result = await usersCollection
            .find()
            .project({ password: 0 })
            .toArray();
        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function getUserRole(req, res, next) {
    try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });
        res.json({ role: user?.role || null });
    } catch (error) {
        next(error);
    }
}

export async function getPublicTutors(req, res, next) {
    try {
        const { limit } = req.query;
        const result = await usersCollection
            .find({ role: "tutor" })
            .project({
                name: 1,
                email: 1,
                photoURL: 1,
                subject: 1,
                university: 1,
                bio: 1,
                location: 1,
                role: 1,
            })
            .limit(parseInt(limit) || 50)
            .toArray();
        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function getTutorById(req, res, next) {
    try {
        const { id } = req.params;
        const tutor = await usersCollection.findOne({
            _id: new ObjectId(id),
            role: "tutor",
        });
        res.json(tutor || null);
    } catch (error) {
        next(error);
    }
}

export async function getUserByEmail(req, res, next) {
    try {
        const { email } = req.params;
        const user = await usersCollection.findOne(
            { email },
            { projection: { password: 0 } },
        );
        res.json(user || null);
    } catch (error) {
        next(error);
    }
}

export async function updateUserProfile(req, res, next) {
    try {
        const { email } = req.params;
        const isAdmin = req.decoded.accessLevel >= 3;

        if (email !== req.decoded.email && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: You can only update your own profile",
            });
        }

        const ALLOWED = [
            "name",
            "photoURL",
            "phone",
            "location",
            "subject",
            "university",
            "bio",
            "salary",
            "skills",
        ];
        const sanitized = {};
        for (const field of ALLOWED) {
            if (req.body[field] !== undefined) {
                sanitized[field] = req.body[field];
            }
        }

        if (Object.keys(sanitized).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid fields provided",
            });
        }

        const result = await usersCollection.updateOne(
            { email },
            { $set: sanitized },
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.json({ success: true, result });
    } catch (error) {
        next(error);
    }
}

export async function updateUserRole(req, res, next) {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { role } },
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function deleteUser(req, res, next) {
    try {
        const { id } = req.params;
        const result = await usersCollection.deleteOne({
            _id: new ObjectId(id),
        });
        res.json(result);
    } catch (error) {
        next(error);
    }
}
