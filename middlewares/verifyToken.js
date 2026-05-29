import jwt from "jsonwebtoken";

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({
            success: false,
            message: "Unauthorized: No authorization header provided",
        });
    }

    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).send({
            success: false,
            message: "Unauthorized: Invalid authorization header format",
        });
    }

    const token = authHeader.slice(7);

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).send({
                    success: false,
                    message: "Unauthorized: Token has expired",
                    expiredAt: err.expiredAt,
                });
            }
            if (err.name === "JsonWebTokenError") {
                return res.status(401).send({
                    success: false,
                    message: "Unauthorized: Invalid token signature",
                });
            }
            return res.status(401).send({
                success: false,
                message: "Unauthorized: Token verification failed",
            });
        }

        if (!decoded.email) {
            return res.status(401).send({
                success: false,
                message: "Unauthorized: Token missing required email claim",
            });
        }

        req.decoded = decoded;
        req.token = token;

        next();
    });
};

export default verifyToken;
