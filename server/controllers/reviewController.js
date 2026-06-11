import { client } from "../config/db.js";

const reviewsCollection = client.db("etuitionbdDB").collection("reviews");

export async function createReview(req, res, next) {
    try {
        const reviewData = req.body;
        const studentEmail = req.decoded.email;

        const existing = await reviewsCollection.findOne({
            tutorEmail: reviewData.tutorEmail,
            studentEmail,
        });

        if (existing) {
            return res.status(400).json({
                message:
                    "You have already reviewed this tutor. You can only submit one review per tutor.",
            });
        }

        reviewData.studentEmail = studentEmail;
        const result = await reviewsCollection.insertOne(reviewData);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
}

export async function getReviewsForTutor(req, res, next) {
    try {
        const { email } = req.params;
        const result = await reviewsCollection
            .find({ tutorEmail: email })
            .sort({ createdAt: -1 })
            .toArray();
        res.json(result);
    } catch (error) {
        next(error);
    }
}
