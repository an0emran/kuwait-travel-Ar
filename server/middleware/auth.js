import jwt from 'jsonwebtoken';

/**
 * verifyToken — reads JWT from secure HttpOnly cookie, verifies signature
 * and expiry, then populates req.user = { id, role }.
 * Responds 401 for missing/invalid/expired tokens.
 */
export function verifyToken(req, res, next) {
    const token = req.cookies?.authToken;
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('FATAL: JWT_SECRET is not set.');
        return res.status(500).json({ error: 'Server authentication configuration error' });
    }
    try {
        const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
        req.user = { id: payload.id, role: payload.role };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expired, please log in again' });
        }
        return res.status(401).json({ error: 'Invalid authentication token' });
    }
}

/** requireAdmin — AFTER verifyToken. Allows only role === 'admin'. */
export function requireAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required' });
    next();
}

/** requireAgent — AFTER verifyToken. Allows role === 'admin' OR 'agent'. */
export function requireAgent(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role !== 'admin' && req.user.role !== 'agent') {
        return res.status(403).json({ error: 'Agent or administrator access required' });
    }
    next();
}

/**
 * verifyCsrf — double-submit cookie pattern.
 * Client reads non-HttpOnly cookie 'csrfToken' and sends it in X-CSRF-Token header.
 * Apply to all state-changing routes (POST, PUT, DELETE).
 */
export function verifyCsrf(req, res, next) {
    const tokenFromCookie = req.cookies?.csrfToken;
    const tokenFromHeader = req.headers['x-csrf-token'];
    if (!tokenFromCookie || !tokenFromHeader) {
        return res.status(403).json({ error: 'CSRF token missing' });
    }
    if (tokenFromCookie !== tokenFromHeader) {
        return res.status(403).json({ error: 'CSRF token mismatch' });
    }
    next();
}
