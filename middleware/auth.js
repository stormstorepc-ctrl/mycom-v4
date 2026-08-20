const jwt = require('jsonwebtoken');
const db = require('../services/database');

async function authenticate(req, res, next) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: '인증이 필요합니다.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const result = await db.query(
            'SELECT id, email, name, role FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: '토큰이 만료되었습니다.' });
        }
        console.error('인증 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}

function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: '인증이 필요합니다.' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        next();
    };
}

module.exports = { authenticate, authorize };
