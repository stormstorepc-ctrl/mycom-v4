const express = require('express');
const db = require('../services/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, async (req, res) => {
    try {
        const { 
            shop_id, 
            quote_id, 
            bid_id, 
            reservation_date, 
            reservation_time, 
            service_type, 
            notes 
        } = req.body;

        if (!shop_id || !reservation_date || !reservation_time || !service_type) {
            return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
        }

        const existingReservation = await db.query(
            `SELECT id FROM reservations 
             WHERE shop_id = $1 
             AND reservation_date = $2 
             AND reservation_time = $3 
             AND status != 'cancelled'`,
            [shop_id, reservation_date, reservation_time]
        );

        if (existingReservation.rows.length > 0) {
            return res.status(409).json({ error: '해당 시간에 이미 예약이 있습니다.' });
        }

        const result = await db.query(
            `INSERT INTO reservations (user_id, shop_id, quote_id, bid_id, reservation_date, reservation_time, service_type, notes) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING *`,
            [req.user.id, shop_id, quote_id, bid_id, reservation_date, reservation_time, service_type, notes]
        );

        const shopResult = await db.query(
            'SELECT user_id, shop_name FROM shops WHERE id = $1',
            [shop_id]
        );

        if (shopResult.rows.length > 0) {
            await db.query(
                `INSERT INTO notifications (user_id, type, title, message, link) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    shopResult.rows[0].user_id,
                    'new_reservation',
                    '새로운 예약',
                    `${reservation_date} ${reservation_time}에 ${service_type} 예약이 접수되었습니다.`,
                    `/admin/reservations`
                ]
            );
        }

        res.status(201).json({
            message: '예약이 완료되었습니다.',
            reservation: result.rows[0]
        });
    } catch (error) {
        console.error('예약 생성 오류:', error);
        res.status(500).json({ error: '예약 생성 중 오류가 발생했습니다.' });
    }
});

router.get('/my', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT r.*, s.shop_name, s.address, s.phone
             FROM reservations r
             JOIN shops s ON s.id = r.shop_id
             WHERE r.user_id = $1
             ORDER BY r.reservation_date DESC, r.reservation_time DESC`,
            [req.user.id]
        );

        res.json({ reservations: result.rows });
    } catch (error) {
        console.error('예약 목록 조회 오류:', error);
        res.status(500).json({ error: '예약 목록 조회 중 오류가 발생했습니다.' });
    }
});

router.get('/shop/:shopId', authenticate, authorize('shop', 'admin'), async (req, res) => {
    try {
        const { shopId } = req.params;

        if (req.user.role === 'shop') {
            const shopResult = await db.query(
                'SELECT user_id FROM shops WHERE id = $1',
                [shopId]
            );

            if (shopResult.rows.length === 0 || shopResult.rows[0].user_id !== req.user.id) {
                return res.status(403).json({ error: '예약 목록 조회 권한이 없습니다.' });
            }
        }

        const result = await db.query(
            `SELECT r.*, u.name as user_name, u.phone as user_phone
             FROM reservations r
             JOIN users u ON u.id = r.user_id
             WHERE r.shop_id = $1
             ORDER BY r.reservation_date DESC, r.reservation_time DESC`,
            [shopId]
        );

        res.json({ reservations: result.rows });
    } catch (error) {
        console.error('매장 예약 목록 조회 오류:', error);
        res.status(500).json({ error: '매장 예약 목록 조회 중 오류가 발생했습니다.' });
    }
});

router.put('/:id/status', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: '올바르지 않은 상태입니다.' });
        }

        const reservationResult = await db.query(
            'SELECT * FROM reservations WHERE id = $1',
            [id]
        );

        if (reservationResult.rows.length === 0) {
            return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
        }

        const reservation = reservationResult.rows[0];

        if (req.user.role === 'user' && reservation.user_id !== req.user.id) {
            return res.status(403).json({ error: '예약 수정 권한이 없습니다.' });
        }

        if (req.user.role === 'shop') {
            const shopResult = await db.query(
                'SELECT user_id FROM shops WHERE id = $1',
                [reservation.shop_id]
            );

            if (shopResult.rows[0]?.user_id !== req.user.id) {
                return res.status(403).json({ error: '예약 수정 권한이 없습니다.' });
            }
        }

        const result = await db.query(
            `UPDATE reservations 
             SET status = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [status, id]
        );

        res.json({ reservation: result.rows[0] });
    } catch (error) {
        console.error('예약 상태 업데이트 오류:', error);
        res.status(500).json({ error: '예약 상태 업데이트 중 오류가 발생했습니다.' });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const reservationResult = await db.query(
            'SELECT * FROM reservations WHERE id = $1',
            [id]
        );

        if (reservationResult.rows.length === 0) {
            return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
        }

        const reservation = reservationResult.rows[0];

        if (reservation.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: '예약 취소 권한이 없습니다.' });
        }

        await db.query(
            'UPDATE reservations SET status = $1, updated_at = NOW() WHERE id = $2',
            ['cancelled', id]
        );

        res.json({ message: '예약이 취소되었습니다.' });
    } catch (error) {
        console.error('예약 취소 오류:', error);
        res.status(500).json({ error: '예약 취소 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
