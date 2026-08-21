const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../services/database');
const ensureAdmin = require('../services/adminBootstrap');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { email, password, name, phone, role = 'user' } = req.body;
        if (!email || !password || !name) return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
        if (password.length < 8) return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
        const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) return res.status(409).json({ error: '이미 등록된 이메일입니다.' });
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await db.query(`INSERT INTO users (email, password_hash, name, phone, role) VALUES ($1,$2,$3,$4,$5) RETURNING id,email,name,role`, [email, passwordHash, name, phone, role]);
        const user = result.rows[0];
        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
        res.status(201).json({ message: '회원가입이 완료되었습니다.', token, user });
    } catch (error) { console.error('회원가입 오류:', error); res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' }); }
});

router.post('/login', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = req.body.password;
        if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
        const configuredAdmin = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
        if (configuredAdmin && email === configuredAdmin) await ensureAdmin();
        const result = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
        res.json({ message: '로그인 성공', token, user: { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone } });
    } catch (error) { console.error('로그인 오류:', error); res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' }); }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const result = await db.query(`SELECT u.id,u.email,u.name,u.phone,u.role,u.profile_image,s.id as shop_id,s.shop_name,s.is_approved FROM users u LEFT JOIN shops s ON s.user_id=u.id WHERE u.id=$1`, [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        res.json({ user: result.rows[0] });
    } catch (error) { console.error('사용자 정보 조회 오류:', error); res.status(500).json({ error: '사용자 정보 조회 중 오류가 발생했습니다.' }); }
});

router.put('/profile', authenticate, async (req, res) => {
    try {
        const { name, phone, profile_image } = req.body;
        const result = await db.query(`UPDATE users SET name=COALESCE($1,name),phone=COALESCE($2,phone),profile_image=COALESCE($3,profile_image),updated_at=NOW() WHERE id=$4 RETURNING id,email,name,phone,role,profile_image`, [name, phone, profile_image, req.user.id]);
        res.json({ user: result.rows[0] });
    } catch (error) { console.error('프로필 업데이트 오류:', error); res.status(500).json({ error: '프로필 업데이트 중 오류가 발생했습니다.' }); }
});

router.post('/register-shop', async (req, res) => {
    try {
        const { email, password, name, phone, shop_name, business_number, address, detail_address, latitude, longitude, shop_phone, open_kakao_url, description } = req.body;
        if (!email || !password || !name || !shop_name || !business_number || !address) return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
        if (open_kakao_url && !/^https:\/\/open\.kakao\.com\//i.test(open_kakao_url)) return res.status(400).json({ error: '카카오톡 오픈채팅 링크 형식을 확인해주세요.' });
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
            if (existingUser.rows.length > 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: '이미 등록된 이메일입니다.' }); }
            const passwordHash = await bcrypt.hash(password, 10);
            const userResult = await client.query(`INSERT INTO users (email,password_hash,name,phone,role) VALUES ($1,$2,$3,$4,'shop') RETURNING id,email,name,role`, [email, passwordHash, name, phone]);
            const userId = userResult.rows[0].id;
            const shopResult = await client.query(`INSERT INTO shops (user_id,shop_name,business_number,address,detail_address,latitude,longitude,phone,open_kakao_url,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [userId, shop_name, business_number, address, detail_address, latitude, longitude, shop_phone, open_kakao_url || null, description]);
            await client.query('COMMIT');
            const token = jwt.sign({ userId, role: 'shop' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
            res.status(201).json({ message: '매장 회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.', token, user: userResult.rows[0], shop: shopResult.rows[0] });
        } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    } catch (error) { console.error('매장 회원가입 오류:', error); res.status(500).json({ error: '매장 회원가입 중 오류가 발생했습니다.' }); }
});

module.exports = router;
