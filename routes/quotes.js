const express = require('express');
const db = require('../services/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, async (req, res) => {
    try {
        const { 
            quote_type, 
            title, 
            description, 
            budget_min, 
            budget_max,
            pc_id,
            expires_at
        } = req.body;

        if (!quote_type || !title) {
            return res.status(400).json({ error: '견적 유형과 제목은 필수입니다.' });
        }

        if (!['sell', 'buy'].includes(quote_type)) {
            return res.status(400).json({ error: '견적 유형이 올바르지 않습니다.' });
        }

        const result = await db.query(
            `INSERT INTO quotes (user_id, pc_id, quote_type, title, description, budget_min, budget_max, expires_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING *`,
            [req.user.id, pc_id, quote_type, title, description, budget_min, budget_max, expires_at]
        );

        res.status(201).json({
            message: '견적 요청이 등록되었습니다.',
            quote: result.rows[0]
        });
    } catch (error) {
        console.error('견적 요청 생성 오류:', error);
        res.status(500).json({ error: '견적 요청 생성 중 오류가 발생했습니다.' });
    }
});

router.get('/', async (req, res) => {
    try {
        const { status, type, user_id } = req.query;

        let query = `
            SELECT q.*, 
                   u.name as user_name,
                   p.title as pc_title,
                   p.cpu, p.gpu, p.ram, p.storage,
                   COUNT(DISTINCT b.id) as bid_count,
                   MIN(b.amount) as min_bid,
                   MAX(b.amount) as max_bid
            FROM quotes q
            JOIN users u ON u.id = q.user_id
            LEFT JOIN pcs p ON p.id = q.pc_id
            LEFT JOIN bids b ON b.quote_id = q.id
            WHERE 1=1
        `;

        const params = [];

        if (status) {
            params.push(status);
            query += ` AND q.status = $${params.length}`;
        }

        if (type) {
            params.push(type);
            query += ` AND q.quote_type = $${params.length}`;
        }

        if (user_id) {
            params.push(user_id);
            query += ` AND q.user_id = $${params.length}`;
        }

        query += ` GROUP BY q.id, u.name, p.title, p.cpu, p.gpu, p.ram, p.storage
                   ORDER BY q.created_at DESC`;

        const result = await db.query(query, params);
        res.json({ quotes: result.rows });
    } catch (error) {
        console.error('견적 목록 조회 오류:', error);
        res.status(500).json({ error: '견적 목록 조회 중 오류가 발생했습니다.' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const quoteResult = await db.query(
            `SELECT q.*, 
                    u.name as user_name,
                    u.email as user_email,
                    p.title as pc_title, p.cpu, p.gpu, p.ram, p.storage,
                    p.motherboard, p.power_supply, p.cooler, p.pc_case,
                    p.condition_grade, p.purchase_date, p.warranty_remaining,
                    p.images as pc_images
             FROM quotes q
             JOIN users u ON u.id = q.user_id
             LEFT JOIN pcs p ON p.id = q.pc_id
             WHERE q.id = $1`,
            [id]
        );

        if (quoteResult.rows.length === 0) {
            return res.status(404).json({ error: '견적을 찾을 수 없습니다.' });
        }

        const bidsResult = await db.query(
            `SELECT b.*, s.shop_name, s.rating, s.address
             FROM bids b
             JOIN shops s ON s.id = b.shop_id
             WHERE b.quote_id = $1
             ORDER BY b.amount ASC`,
            [id]
        );

        res.json({
            quote: quoteResult.rows[0],
            bids: bidsResult.rows
        });
    } catch (error) {
        console.error('견적 상세 조회 오류:', error);
        res.status(500).json({ error: '견적 상세 조회 중 오류가 발생했습니다.' });
    }
});

router.put('/:id/status', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, selected_bid_id } = req.body;

        const quoteResult = await db.query(
            'SELECT user_id FROM quotes WHERE id = $1',
            [id]
        );

        if (quoteResult.rows.length === 0) {
            return res.status(404).json({ error: '견적을 찾을 수 없습니다.' });
        }

        if (quoteResult.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: '견적 수정 권한이 없습니다.' });
        }

        const result = await db.query(
            `UPDATE quotes 
             SET status = $1, 
                 selected_bid_id = $2,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [status, selected_bid_id, id]
        );

        if (selected_bid_id) {
            await db.query(
                'UPDATE bids SET is_selected = TRUE WHERE id = $1',
                [selected_bid_id]
            );
        }

        res.json({ quote: result.rows[0] });
    } catch (error) {
        console.error('견적 상태 업데이트 오류:', error);
        res.status(500).json({ error: '견적 상태 업데이트 중 오류가 발생했습니다.' });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const quoteResult = await db.query(
            'SELECT user_id FROM quotes WHERE id = $1',
            [id]
        );

        if (quoteResult.rows.length === 0) {
            return res.status(404).json({ error: '견적을 찾을 수 없습니다.' });
        }

        if (quoteResult.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: '견적 삭제 권한이 없습니다.' });
        }

        await db.query('DELETE FROM quotes WHERE id = $1', [id]);

        res.json({ message: '견적이 삭제되었습니다.' });
    } catch (error) {
        console.error('견적 삭제 오류:', error);
        res.status(500).json({ error: '견적 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
