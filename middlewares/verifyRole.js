/**
 * Middleware factory to verify user has a specific role or access level
 * Usage: app.get('/route', verifyToken, verifyRole('admin'), handler)
 *        app.get('/route', verifyToken, verifyRole(['admin', 'tutor']), handler)
 *        app.get('/route', verifyToken, verifyRole(null, 2), handler) // accessLevel >= 2
 */

export const verifyRole = (allowedRoles = null, minAccessLevel = null) => {
    return (req, res, next) => {
        const userRole = req.decoded?.role;
        const userAccessLevel = req.decoded?.accessLevel;

        // Check role if specified
        if (allowedRoles) {
            const rolesArray = Array.isArray(allowedRoles)
                ? allowedRoles
                : [allowedRoles];

            if (!rolesArray.includes(userRole)) {
                return res.status(403).send({
                    success: false,
                    message: `Forbidden: Requires one of roles ${rolesArray.join(", ")}`,
                    requiredRoles: rolesArray,
                    currentRole: userRole,
                });
            }
        }

        // Check access level if specified
        if (minAccessLevel !== null && minAccessLevel !== undefined) {
            if (!userAccessLevel || userAccessLevel < minAccessLevel) {
                return res.status(403).send({
                    success: false,
                    message: `Forbidden: Requires access level ${minAccessLevel} or higher`,
                    requiredAccessLevel: minAccessLevel,
                    currentAccessLevel: userAccessLevel || 0,
                });
            }
        }

        next();
    };
};

export default verifyRole;
