import { ObjectId } from "mongodb";
import { client } from "../config/db.js";

const bookmarksCollection = client.db("etuitionbdDB").collection("bookmarks");

export async function createBookmark(req, res, next) {
    try {
        const data = req.body;
        const tutorEmail = req.decoded.email;
        const tuitionId =
            data.tuitionId || data._id || data.id || data.tuitionID;

        if (!tuitionId) {
            return res.status(400).json({
                success: false,
                message: "tuitionId is required in request body",
            });
        }

        const tuitionIdStr = tuitionId.toString();
        const existing = await bookmarksCollection.findOne({
            tuitionId: tuitionIdStr,
            tutorEmail,
        });

        if (existing) {
            return res.status(200).json({
                success: true,
                message: "Already Bookmarked",
                _id: existing._id,
            });
        }

        const bookmark = {
            ...data,
            tuitionId: tuitionIdStr,
            tutorEmail,
            bookmarkedAt: new Date(),
        };

        const result = await bookmarksCollection.insertOne(bookmark);
        res.status(201).json({ success: true, _id: result.insertedId });
    } catch (error) {
        next(error);
    }
}

export async function getBookmarks(req, res, next) {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({
                message: "email query parameter is required",
            });
        }

        const result = await bookmarksCollection
            .find({ tutorEmail: email })
            .toArray();
        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function getBookmarksByEmail(req, res, next) {
    try {
        const { email } = req.params;
        const result = await bookmarksCollection
            .find({ tutorEmail: email })
            .toArray();
        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function deleteBookmark(req, res, next) {
    try {
        const { id, tuitionId } = req.query;
        const bodyId = req.body?.id;
        const bodyTuitionId = req.body?.tuitionId;

        let filter = null;
        if (id || bodyId) {
            try {
                filter = { _id: new ObjectId(id || bodyId) };
            } catch {
                return res.status(400).json({
                    success: false,
                    message: "Invalid bookmark ID format",
                });
            }
        } else if (tuitionId) {
            filter = {
                tuitionId: tuitionId.toString(),
                tutorEmail: req.decoded.email,
            };
        } else if (bodyTuitionId) {
            filter = {
                tuitionId: bodyTuitionId.toString(),
                tutorEmail: req.decoded.email,
            };
        } else {
            return res.status(400).json({
                success: false,
                message:
                    "Bookmark id or tuitionId is required to delete a bookmark",
            });
        }

        const result = await bookmarksCollection.deleteOne(filter);
        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Bookmark not found",
            });
        }

        res.json({ success: true, deletedCount: result.deletedCount });
    } catch (error) {
        next(error);
    }
}

export async function deleteBookmarkById(req, res, next) {
    try {
        const result = await bookmarksCollection.deleteOne({
            _id: new ObjectId(req.params.id),
        });
        res.json(result);
    } catch (error) {
        next(error);
    }
}
