const express = require('express');
const db = require('../services/database');
const { authenticate, authorize } = require('../middleware/auth');
const { getIO } = require('../services/socket');

const router = express.Router();

router.post('/', authenticate, authorize('shop'), async (req, res) => {
    try {
        const { quote_id, amount, message, parts_detail } = req.body;

        if (!quote_id || !amount) {
            return res.status(400).json({ error: '견적 ID와 입찰 금액은 필수입니다.' });
        }

        const shopResult = await db.query(
            'SELECT id, shop_name, is_approved FROM shops WHERE user_id = $1',
            [req.user.id]
        );

        if (shopResult.rows.length === 0) {
            return res.status(404).json({ error: '등록된 매장이 없습니다.' });
        }

        if (!shopResult.rows[0].is_approved) {
            return res.status(403).json({ error: '매장 승인이 필요합니다.' });
        }

        const shopId = shopResult.rows[0].id;

        const quoteResult = await db.query(
            'SELECT status FROM quotes WHERE id = $1',
            [quote_id]
        );

        if (quoteResult.rows.length === 0) {
            return res.status(404).json({ error: '견적을 찾을 수 없습니다.' });
        }

        if (!['open', 'bidding'].includes(quoteResult.rows[0].status)) {
            return res.status(400).json({ error: '입찰이 마감된 견적입니다.' });
        }

        const result = await db.query(
            `INSERT INTO bids (quote_id, shop_id, amount, message, parts_detail) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [quote_id, shopId, amount, message, parts_detail]
        );

        const newBid = result.rows[0];
        newBid.shop_name = shopResult.rows[0].shop_name;

        await db.query(
            'UPDATE quotes SET status = $1, updated_at = NOW() WHERE id = $2',
            ['bidding', quote_id]
        );

        const io = getIO();
        if (io) {
            io.to(`quote-${quote_id}`).emit('bid-updated', newBid);
        }

        const quoteOwner = await db.query(
            'SELECT user_id, title FROM quotes WHERE id = $1',
            [quote_id]
        );

        if (quoteOwner.rows.length > 0) {
            await db.query(
                `INSERT INTO notifications (user_id, type, title, message, link) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    quoteOwner.rows[0].user_id,
                    'new_bid',
                    '새로운 입찰',
                    `"${quoteOwner.rows[0].title}"에 ${shopResult.rows[0].shop_name}이(가) ${amount.toLocaleString()}원으로 입찰했습니다.`,
                    `/quotes/${quote_id}`
                ]
            );
        }

        res.status(201).json({
            message: '입찰이 등록되었습니다.',
            bid: newBid
        });
    } catch (error) {
        console.error('입찰 등록 오류:', error);
        res.status(500).json({ error: '입찰 등록 중 오류가 발생했습니다.' });
    }
});

router.get('/quote/:quoteId', async (req, res) => {
    try {
        const { quoteId } = req.params;

        const result = await db.query(
            `SELECT b.*, s.shop_name, s.rating, s.address, s.phone
             FROM bids b
             JOIN shops s ON s.id = b.shop_id
             WHERE b.quote_id = $1
             ORDER BY b.amount ASC`,
            [quoteId]
        );

        res.json({ bids: result.rows });
    } catch (error) {
        console.error('입찰 목록 조회 오류:', error);
        res.status(500).json({ error: '입찰 목록 조회 중 오류가 발생했습니다.' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT b.*, s.shop_name, s.rating, s.address, s.phone, s.description
             FROM bids b
             JOIN shops s ON s.id = b.shop_id
             WHERE b.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '입찰을 찾을 수 없습니다.' });
        }

        res.json({ bid: result.rows[0] });
    } catch (error) {
        console.error('입찰 상세 조회 오류:', error);
        res.status(500).json({ error: '입찰 상세 조회 중 오류가 발생했습니다.' });
    }
});

router.put('/:id', authenticate, authorize('shop'), async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, message, parts_detail } = req.body;

        const bidResult = await db.query(
            `SELECT b.*, s.user_id 
             FROM bids b
             JOIN shops s ON s.id = b.shop_id
             WHERE b.id = $1`,
            [id]
        );

        if (bidResult.rows.length === 0) {
            return res.status(404).json({ error: '입찰을 찾을 수 없습니다.' });
        }

        if (bidResult.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: '입찰 수정 권한이 없습니다.' });
        }

        const result = await db.query(
            `UPDATE bids 
             SET amount = COALESCE($1, amount),
                 message = COALESCE($2, message),
                 parts_detail = COALESCE($3, parts_detail),
                 updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [amount, message, parts_detail, id]
        );

        const io = getIO();
        if (io) {
            io.to(`quote-${bidResult.rows[0].quote_id}`).emit('bid-updated', result.rows[0]);
        }

        res.json({ bid: result.rows[0] });
    } catch (error) {
        console.error('입찰 수정 오류:', error);
        res.status(500).json({ error: '입찰 수정 중 오류가 발생했습니다.' });
    }
});

router.delete('/:id', authenticate, authorize('shop'), async (req, res) => {
    try {
        const { id } = req.params;

        const bidResult = await db.query(
            `SELECT b.*, s.user_id 
             FROM bids b
             JOIN shops s ON s.id = b.shop_id
             WHERE b.id = $1`,
            [id]
        );

        if (bidResult.rows.length === 0) {
            return res.status(404).json({ error: '입찰을 찾을 수 없습니다.' });
        }

        if (bidResult.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: '입찰 삭제 권한이 없습니다.' });
        }

        await db.query('DELETE FROM bids WHERE id = $1', [id]);

        res.json({ message: '입찰이 삭제되었습니다.' });
    } catch (error) {
        console.error('입찰 삭제 오류:', error);
        res.status(500).json({ error: '입찰 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
