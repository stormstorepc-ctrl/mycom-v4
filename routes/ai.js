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

async function askOpenAIWithWebSearch(prompt) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    const model = process.env.AI_MODEL_DEFAULT || 'gpt-5.6-luna';
    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
            model,
            tools: [{
                type: 'web_search',
                filters: { allowed_domains: ['danawa.com'] },
                search_context_size: 'medium'
            }],
            input: prompt
        })
    });
    if (!response.ok) throw new Error(`OpenAI web search ${response.status}: ${await response.text()}`);
    const data = await response.json();
    return {
        text: data.output_text || data.output?.flatMap(o => o.content || []).find(c => c.type === 'output_text')?.text || '',
        response: data
    };
}

function extractJson(text) {
    if (!text) return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const source = fenced ? fenced[1] : text;
    const match = source.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
}

async function liveDanawaRecommendation({ usage, usageLabel, budget }) {
    const safeBudget = Math.max(300000, Math.min(10000000, Number(budget) || 1500000));
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `
오늘 날짜는 ${today}입니다. 한국 시장에서 판매되는 데스크탑 부품으로 MYCOM PC 견적을 만들어 주세요.

사용 용도: ${usageLabel || usage}
예산: ${safeBudget.toLocaleString('ko-KR')}원

반드시 다나와(대한민국) 페이지를 웹 검색해서 현재 가격을 확인하고, 가능하면 각 부품의 "카드 최저가"를 사용하세요. 현금 최저가나 단순 검색 스니펫 가격을 카드 최저가로 둔갑시키지 마세요. 같은 제품군의 서로 다른 모델을 섞지 말고, 현재 판매/가격비교가 확인되는 제품을 우선하세요.

추천해야 할 부품: CPU, GPU, 메인보드, RAM, SSD, 파워, CPU 쿨러, 케이스.
용도와 예산에 맞춰 GPU/CPU/RAM/SSD의 예산 배분을 조정하고, 부품 호환성(소켓/메모리 규격/파워 용량)을 확인하세요.
총액은 각 부품의 확인된 카드 기준 예상가를 더한 값으로 계산하세요. 예산을 약간 초과하는 것보다 예산 안에서 성능을 최대화하는 구성을 우선하세요.

가격을 확인할 수 없는 부품은 임의의 확정 가격을 만들지 말고 가격을 null로 두고, 추천은 계속하되 전체 상태를 "partial"로 표시하세요.

응답은 반드시 아래 JSON 하나만 반환하세요. 설명 문장이나 마크다운은 금지합니다.
{
  "status": "live|partial|fallback",
  "date": "YYYY-MM-DD",
  "source": "Danawa card-price reference",
  "usage": "game|video|office|ai",
  "usageLabel": "...",
  "budget": 1500000,
  "total": 1490000,
  "title": "...",
  "summary": "...",
  "components": [
    {"category":"CPU","name":"...","price":0,"priceType":"card","sourceUrl":"https://...","reason":"..."},
    {"category":"GPU","name":"...","price":0,"priceType":"card","sourceUrl":"https://...","reason":"..."},
    {"category":"메인보드","name":"...","price":0,"priceType":"card","sourceUrl":"https://...","reason":"..."},
    {"category":"RAM","name":"...","price":0,"priceType":"card","sourceUrl":"https://...","reason":"..."},
    {"category":"SSD","name":"...","price":0,"priceType":"card","sourceUrl":"https://...","reason":"..."},
    {"category":"파워","name":"...","price":0,"priceType":"card","sourceUrl":"https://...","reason":"..."},
    {"category":"CPU 쿨러","name":"...","price":0,"priceType":"card","sourceUrl":"https://...","reason":"..."},
    {"category":"케이스","name":"...","price":0,"priceType":"card","sourceUrl":"https://...","reason":"..."}
  ]
}
`.trim();

    try {
        const result = await askOpenAIWithWebSearch(prompt);
        const parsed = extractJson(result?.text);
        if (!parsed || !Array.isArray(parsed.components)) return null;
        const normalized = parsed.components.map(c => ({
            category: String(c.category || ''),
            name: String(c.name || '선정 불가'),
            price: Number.isFinite(Number(c.price)) ? Number(c.price) : null,
            priceType: c.priceType === 'card' ? 'card' : 'reference',
            sourceUrl: typeof c.sourceUrl === 'string' ? c.sourceUrl : '',
            reason: String(c.reason || '')
        }));
        const knownTotal = normalized.reduce((sum, c) => sum + (Number.isFinite(c.price) ? c.price : 0), 0);
        return {
            status: parsed.status === 'live' || parsed.status === 'partial' ? parsed.status : 'partial',
            date: parsed.date || today,
            source: 'Danawa card-price reference via web search',
            usage: parsed.usage || usage,
            usageLabel: parsed.usageLabel || usageLabel,
            budget: safeBudget,
            total: knownTotal || Number(parsed.total) || 0,
            title: parsed.title || `${usageLabel || 'PC'} 추천 구성`,
            summary: parsed.summary || `예산 ${safeBudget.toLocaleString('ko-KR')}원 기준 다나와 카드가 참고 구성`,
            components: normalized
        };
    } catch (error) {
        console.warn('실시간 다나와 추천 조회 실패:', error.message);
        return null;
    }
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

router.post('/pc-build-recommend', authenticate, async (req, res) => {
    try {
        const { usage = 'game', usageLabel = '게임용', budget = 1500000 } = req.body || {};
        const live = await liveDanawaRecommendation({ usage, usageLabel, budget });
        if (!live) return res.status(503).json({ error: '오늘의 다나와 카드가를 조회하지 못했습니다. 잠시 후 다시 시도해주세요.' });
        res.json({ recommendation: live, generatedAt: new Date().toISOString(), livePriceReference: true });
    } catch (error) {
        console.error('실시간 PC 견적 오류:', error);
        res.status(500).json({ error: '실시간 PC 견적을 생성하는 중 오류가 발생했습니다.' });
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
