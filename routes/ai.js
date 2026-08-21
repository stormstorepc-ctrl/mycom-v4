const express = require('express');
const db = require('../services/database');
const { authenticate } = require('../middleware/auth');
const { analyzePC } = require('../services/ai');

const router = express.Router();

async function askOpenAI(message, mode = 'general', history = []) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    const model = mode === 'complex'
        ? (process.env.AI_MODEL_COMPLEX || 'gpt-5.6-terra')
        : (process.env.AI_MODEL_DEFAULT || 'gpt-5.6-luna');
    const system = `당신은 MYCOM의 친절한 PC 전문 AI 상담사입니다. 고객의 조립대행, 컴퓨터 견적, 방문예약, 중고PC 판매, 수리/업그레이드 상담을 돕습니다. 최신 가격이나 실제 재고를 확정하지 말고, 정확한 금액·실물 확인·출장·예약·거래가 필요하면 human_required를 true로 판단하세요. 답변은 한국어로 쉽고 구체적으로 하며, 불확실하면 솔직히 말합니다. mode=${mode}`;
    const input = [{ role: 'system', content: system }, ...history.slice(-8).map(x => ({ role: x.role, content: x.content })), { role: 'user', content: message }];
    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, input })
    });
    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
    const data = await response.json();
    return data.output_text || data.output?.flatMap(o => o.content || []).find(c => c.type === 'output_text')?.text || '';
}

function needsHuman(message, mode, answer) {
    const text = `${message} ${answer || ''}`.toLowerCase();
    const keywords = ['실제 가격', '정확한 가격', '재고', '출장', '방문', '예약', '매입', '팔고', '수리', '조립대행', '사장님', '업체 연결', '상담원'];
    return mode === 'human' || keywords.some(k => text.includes(k)) || /사장님|업체|전문가/.test(message);
}

router.post('/analyze-pc', authenticate, async (req, res) => {
    try {
        const pcData = req.body;
        if (!pcData.cpu && !pcData.gpu) return res.status(400).json({ error: 'CPU 또는 GPU 정보는 필수입니다.' });
        const analysis = await analyzePC(pcData);
        res.json({ analysis, analyzedAt: new Date().toISOString() });
    } catch (error) {
        console.error('PC 분석 오류:', error);
        res.status(500).json({ error: 'PC 분석 중 오류가 발생했습니다.' });
    }
});

router.post('/chat', authenticate, async (req, res) => {
    try {
        const { message, mode = 'general', history = [], category = 'general' } = req.body;
        if (!message?.trim()) return res.status(400).json({ error: '메시지를 입력해주세요.' });
        let response;
        try {
            response = await askOpenAI(message.trim(), mode === 'complex' ? 'complex' : 'general', history);
        } catch (e) {
            console.warn('OpenAI 호출 실패:', e.message);
        }
        if (!response) response = generateFallback(message);
        const humanRequired = needsHuman(message, mode, response);
        res.json({ response, humanRequired, category, model: process.env.OPENAI_API_KEY ? (mode === 'complex' ? (process.env.AI_MODEL_COMPLEX || 'gpt-5.6-terra') : (process.env.AI_MODEL_DEFAULT || 'gpt-5.6-luna')) : 'fallback', timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('AI 채팅 오류:', error);
        res.status(500).json({ error: 'AI 채팅 중 오류가 발생했습니다.' });
    }
});

router.post('/connect-expert', authenticate, async (req, res) => {
    try {
        const { latitude, longitude, category = 'general', summary = '' } = req.body;
        if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return res.status(400).json({ error: '고객 위치 정보가 필요합니다.' });
        const shops = await db.query(`SELECT s.*, u.name AS owner_name, (6371 * acos(LEAST(1, GREATEST(-1, cos(radians($1))*cos(radians(s.latitude))*cos(radians(s.longitude)-radians($2))+sin(radians($1))*sin(radians(s.latitude)))))) AS distance FROM shops s JOIN users u ON u.id=s.user_id WHERE s.is_approved=TRUE AND s.is_active=TRUE AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL ORDER BY distance ASC LIMIT 5`, [latitude, longitude]);
        if (!shops.rows.length) return res.status(404).json({ error: '현재 위치 주변에 승인된 MYCOM 업체가 없습니다.' });
        const shop = shops.rows[0];
        const room = await db.query(`INSERT INTO chat_rooms (user_id, shop_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *`, [req.user.id, shop.id]);
        let roomRow = room.rows[0];
        if (!roomRow) { const existing = await db.query('SELECT * FROM chat_rooms WHERE user_id=$1 AND shop_id=$2 ORDER BY created_at DESC LIMIT 1',[req.user.id,shop.id]); roomRow=existing.rows[0]; }
        const messageText = `🤖 MYCOM AI 상담 연결\n상담 분야: ${category}\nAI 상담 요약: ${summary || '고객이 전문가 상담을 요청했습니다.'}`;
        await db.query(`INSERT INTO messages (room_id,sender_id,sender_type,message) VALUES ($1,$2,'user',$3)`, [roomRow.id, req.user.id, messageText]);
        await db.query(`INSERT INTO notifications (user_id,type,title,message,link) VALUES ($1,'new_chat','MYCOM 새 고객 상담','MYCOM에서 새로운 고객 상담이 도착했습니다. 상담 내용을 확인해주세요.', $2)`, [shop.user_id, `/chat.html?room=${roomRow.id}`]);
        res.status(201).json({ shop: { id: shop.id, shop_name: shop.shop_name, distance_km: Number(shop.distance), rating: shop.rating }, room: roomRow, notified: true });
    } catch (error) {
        console.error('전문가 연결 오류:', error);
        res.status(500).json({ error: '전문가 연결 중 오류가 발생했습니다.' });
    }
});

function generateFallback(message) {
    const m = message.toLowerCase();
    if (m.includes('팔') || m.includes('중고')) return '중고 PC 판매 상담을 도와드릴게요. CPU, GPU, RAM, SSD와 제품 상태를 알려주시면 예상 범위를 안내하고 정확한 매입가는 가까운 업체 사장님에게 연결해드릴 수 있습니다.';
    if (m.includes('방문') || m.includes('수리')) return '방문 수리나 정확한 작업비는 현장 확인이 필요할 수 있습니다. 원하시면 현재 위치에서 가까운 승인 업체 사장님에게 연결해드릴게요.';
    if (m.includes('견적') || m.includes('조립')) return '예산과 사용 용도, 원하는 게임 또는 작업 프로그램을 알려주세요. AI가 먼저 구성안을 잡고 실제 부품 가격과 재고가 필요하면 가까운 업체로 연결해드릴게요.';
    return '안녕하세요! MYCOM AI 상담사입니다. 조립대행, PC 견적, 방문예약, 중고PC 판매, 수리/업그레이드를 도와드릴 수 있습니다. 무엇이 궁금하신가요?';
}

module.exports = router;
