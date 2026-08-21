const express = require('express');
const db = require('../services/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/my', authenticate, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const result = await db.query(
      `SELECT id,type,title,message,link,is_read,created_at
       FROM notifications
       WHERE user_id=$1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );
    const unread = await db.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND is_read=FALSE`,
      [req.user.id]
    );
    res.json({ notifications: result.rows, unread_count: unread.rows[0].count });
  } catch (e) {
    console.error('알림 조회 오류:', e);
    res.status(500).json({ error: '알림을 불러오지 못했습니다.' });
  }
});

router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2 RETURNING id,is_read`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
    res.json({ notification: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: '알림 처리에 실패했습니다.' });
  }
});

router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await db.query(`UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND is_read=FALSE`, [req.user.id]);
    res.json({ message: '모든 알림을 읽었습니다.' });
  } catch (e) {
    res.status(500).json({ error: '알림 처리에 실패했습니다.' });
  }
});

module.exports = router;
