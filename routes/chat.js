const express = require('express');
const db = require('../services/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function canAccessRoom(user, room){
    if(user.role === 'admin') return true;
    if(user.role === 'shop'){
        const r=await db.query('SELECT id FROM shops WHERE user_id=$1 LIMIT 1',[user.id]);
        return r.rows[0]?.id===room.shop_id;
    }
    return room.user_id===user.id;
}

router.post('/rooms', authenticate, async (req, res) => {
    try {
        const { shop_id, quote_id } = req.body;
        if (!shop_id) return res.status(400).json({ error: '매장 ID는 필수입니다.' });
        const shop=await db.query('SELECT id,is_approved,is_active FROM shops WHERE id=$1',[shop_id]);
        if(!shop.rows.length||!shop.rows[0].is_approved||shop.rows[0].is_active===false)return res.status(404).json({error:'상담 가능한 업체를 찾을 수 없습니다.'});
        const existingRoom = await db.query(`SELECT * FROM chat_rooms WHERE user_id = $1 AND shop_id = $2 AND (quote_id = $3 OR quote_id IS NULL) LIMIT 1`,[req.user.id, shop_id, quote_id]);
        if (existingRoom.rows.length > 0) return res.json({ room: existingRoom.rows[0] });
        const result = await db.query(`INSERT INTO chat_rooms (user_id, shop_id, quote_id) VALUES ($1, $2, $3) RETURNING *`,[req.user.id, shop_id, quote_id]);
        res.status(201).json({ room: result.rows[0] });
    } catch (error) { console.error('채팅방 생성 오류:', error);res.status(500).json({ error: '채팅방 생성 중 오류가 발생했습니다.' }); }
});

router.get('/rooms', authenticate, async (req, res) => {
    try {
        let result;
        if (req.user.role === 'shop') {
            const shopResult = await db.query('SELECT id FROM shops WHERE user_id = $1',[req.user.id]);
            if (!shopResult.rows.length) return res.json({ rooms: [] });
            result = await db.query(`SELECT cr.*,u.name as other_party_name,s.shop_name,(SELECT message FROM messages m WHERE m.room_id = cr.id ORDER BY m.created_at DESC LIMIT 1) as last_message,(SELECT created_at FROM messages m WHERE m.room_id = cr.id ORDER BY m.created_at DESC LIMIT 1) as last_message_time,(SELECT COUNT(*) FROM messages m WHERE m.room_id = cr.id AND m.is_read = FALSE AND m.sender_type != 'shop') as unread_count FROM chat_rooms cr JOIN users u ON u.id = cr.user_id JOIN shops s ON s.id = cr.shop_id WHERE cr.shop_id = $1 ORDER BY last_message_time DESC NULLS LAST`,[shopResult.rows[0].id]);
        } else {
            result = await db.query(`SELECT cr.*,s.shop_name as other_party_name,(SELECT message FROM messages m WHERE m.room_id = cr.id ORDER BY m.created_at DESC LIMIT 1) as last_message,(SELECT created_at FROM messages m WHERE m.room_id = cr.id ORDER BY m.created_at DESC LIMIT 1) as last_message_time,(SELECT COUNT(*) FROM messages m WHERE m.room_id = cr.id AND m.is_read = FALSE AND m.sender_type != 'user') as unread_count FROM chat_rooms cr JOIN shops s ON s.id = cr.shop_id WHERE cr.user_id = $1 ORDER BY last_message_time DESC NULLS LAST`,[req.user.id]);
        }
        res.json({ rooms: result.rows });
    } catch (error) { console.error('채팅방 목록 조회 오류:', error);res.status(500).json({ error: '채팅방 목록 조회 중 오류가 발생했습니다.' }); }
});

router.get('/rooms/:roomId/messages', authenticate, async (req, res) => {
    try {
        const roomResult = await db.query('SELECT * FROM chat_rooms WHERE id = $1',[req.params.roomId]);
        if (!roomResult.rows.length) return res.status(404).json({ error: '채팅방을 찾을 수 없습니다.' });
        const room=roomResult.rows[0];
        if(!(await canAccessRoom(req.user,room)))return res.status(403).json({error:'채팅방 접근 권한이 없습니다.'});
        const result = await db.query(`SELECT m.*, u.name as sender_name FROM messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.room_id = $1 ORDER BY m.created_at ASC`,[req.params.roomId]);
        await db.query(`UPDATE messages SET is_read = TRUE WHERE room_id = $1 AND sender_id != $2 AND is_read = FALSE`,[req.params.roomId, req.user.id]);
        res.json({ messages: result.rows });
    } catch (error) { console.error('메시지 조회 오류:', error);res.status(500).json({ error: '메시지 조회 중 오류가 발생했습니다.' }); }
});

router.post('/rooms/:roomId/messages', authenticate, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !String(message).trim()) return res.status(400).json({ error: '메시지 내용은 필수입니다.' });
        const roomResult=await db.query('SELECT * FROM chat_rooms WHERE id=$1',[req.params.roomId]);
        if(!roomResult.rows.length)return res.status(404).json({error:'채팅방을 찾을 수 없습니다.'});
        if(!(await canAccessRoom(req.user,roomResult.rows[0])))return res.status(403).json({error:'메시지 전송 권한이 없습니다.'});
        const result = await db.query(`INSERT INTO messages (room_id, sender_id, sender_type, message) VALUES ($1, $2, $3, $4) RETURNING *`,[req.params.roomId, req.user.id, req.user.role === 'shop' ? 'shop' : 'user', String(message).trim().slice(0,4000)]);
        const newMessage = result.rows[0];newMessage.sender_name = req.user.name;
        res.status(201).json({ message: newMessage });
    } catch (error) { console.error('메시지 전송 오류:', error);res.status(500).json({ error: '메시지 전송 중 오류가 발생했습니다.' }); }
});
module.exports=router;
