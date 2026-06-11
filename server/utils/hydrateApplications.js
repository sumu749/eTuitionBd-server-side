import { ObjectId } from "mongodb";

export async function hydrateApplications(
    applications,
    usersCollection,
    tuitionsCollection,
) {
    if (!Array.isArray(applications) || applications.length === 0) {
        return [];
    }

    const userEmails = new Set();
    const tuitionIds = new Set();

    applications.forEach((application) => {
        if (application.studentEmail) {
            userEmails.add(application.studentEmail);
        }
        if (application.tutorEmail) {
            userEmails.add(application.tutorEmail);
        }
        if (application.tuitionId) {
            tuitionIds.add(application.tuitionId.toString());
        }
    });

    const users = await usersCollection
        .find({ email: { $in: [...userEmails] } })
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
        .toArray();

    const userMap = users.reduce((acc, user) => {
        acc[user.email] = user;
        return acc;
    }, {});

    const validTuitionObjectIds = [...tuitionIds].reduce((acc, id) => {
        try {
            acc.push(new ObjectId(id));
        } catch {
            // ignore invalid IDs
        }
        return acc;
    }, []);

    const tuitions = await tuitionsCollection
        .find({ _id: { $in: validTuitionObjectIds } })
        .project({
            _id: 1,
            subject: 1,
            classLevel: 1,
            budget: 1,
            location: 1,
            status: 1,
            studentEmail: 1,
            createdAt: 1,
        })
        .toArray();

    const tuitionMap = tuitions.reduce((acc, tuition) => {
        acc[tuition._id.toString()] = tuition;
        return acc;
    }, {});

    return applications.map((application) => ({
        ...application,
        student: userMap[application.studentEmail] || null,
        tutor: userMap[application.tutorEmail] || null,
        tuition: tuitionMap[application.tuitionId?.toString()] || null,
    }));
}
