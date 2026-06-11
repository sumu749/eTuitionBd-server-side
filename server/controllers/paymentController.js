import Stripe from "stripe";
import { ObjectId } from "mongodb";
import { client } from "../config/db.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const transactionsCollection = client
    .db("etuitionbdDB")
    .collection("transactions");
const applicationsCollection = client
    .db("etuitionbdDB")
    .collection("applications");

export async function createPaymentIntent(req, res, next) {
    try {
        const { amount } = req.body;
        const paymentIntent = await stripe.paymentIntents.create({
            amount: parseInt(amount * 100, 10),
            currency: "usd",
            payment_method_types: ["card"],
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        next(error);
    }
}

export async function saveTransaction(req, res, next) {
    const session = client.startSession();
    try {
        const txData = req.body;
        const studentEmail = req.decoded.email;

        const application = await applicationsCollection.findOne({
            _id: new ObjectId(txData.applicationId),
            studentEmail,
        });

        if (!application) {
            return res.status(403).json({ message: "Forbidden" });
        }

        let result;
        await session.withTransaction(async () => {
            result = await transactionsCollection.insertOne(txData, {
                session,
            });
            await applicationsCollection.updateOne(
                { _id: application._id },
                { $set: { status: "approved" } },
                { session },
            );
        });

        res.status(201).json(result);
    } catch (error) {
        next(error);
    } finally {
        await session.endSession();
    }
}

export async function getAllTransactions(req, res, next) {
    try {
        const result = await transactionsCollection
            .find()
            .sort({ paymentDate: -1 })
            .toArray();
        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function getTransactionById(req, res, next) {
    try {
        const { id } = req.params;
        const transaction = await transactionsCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        const requesterEmail = req.decoded.email;
        const isAdmin = req.decoded.accessLevel >= 3;

        if (
            !isAdmin &&
            requesterEmail !== transaction.studentEmail &&
            requesterEmail !== transaction.tutorEmail
        ) {
            return res.status(403).json({ message: "Forbidden Access" });
        }

        res.json(transaction);
    } catch (error) {
        next(error);
    }
}

export async function getPaymentsByStudent(req, res, next) {
    try {
        const { email } = req.query;
        if (email !== req.decoded.email) {
            return res.status(403).json({ message: "Forbidden Access" });
        }

        const result = await transactionsCollection
            .find({ studentEmail: email })
            .sort({ paymentDate: -1 })
            .toArray();

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function getRevenueForTutor(req, res, next) {
    try {
        const { email } = req.params;
        if (email !== req.decoded.email) {
            return res.status(403).json({ message: "Forbidden Access" });
        }

        const result = await transactionsCollection
            .find({ tutorEmail: email })
            .sort({ paymentDate: -1 })
            .toArray();

        res.json(result);
    } catch (error) {
        next(error);
    }
}
