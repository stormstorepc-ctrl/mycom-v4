const express = require('express');
const db = require('../services/database');
const { authenticate } = require('../middleware/auth');
const { analyzePC } = require('../services/ai');

const router = express.Router();

router.post('/analyze-pc', authenticate, async (req, res) => {
    try {
        const pcData = req.body;

        if (!pcData.cpu && !pcData.gpu) {
            return res.status(400).json({ error: 'CPU 또는 GPU 정보는 필수입니다.' });
        }

        const analysis = await analyzePC(pcData);

        res.json({
            analysis,
            analyzedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('PC 분석 오류:', error);
        res.status(500).json({ error: 'PC 분석 중 오류가 발생했습니다.' });
    }
});

router.post('/chat', authenticate, async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: '메시지를 입력해주세요.' });
        }

        const response = generateAIResponse(message);

        res.json({
            response,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('AI 채팅 오류:', error);
        res.status(500).json({ error: 'AI 채팅 중 오류가 발생했습니다.' });
    }
});

function generateAIResponse(message) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('추천') || lowerMessage.includes('견적') || lowerMessage.includes('맞춰')) {
        if (lowerMessage.includes('게임') || lowerMessage.includes('게이밍')) {
            return `게이밍 PC 추천드립니다!\n\n[150만원대 게이밍 PC]\n- CPU: Ryzen 5 7600X\n- GPU: RTX 4060 Ti\n- RAM: DDR5 32GB\n- SSD: NVMe 1TB\n\n[250만원대 게이밍 PC]\n- CPU: Ryzen 7 7800X3D\n- GPU: RTX 4070 Super\n- RAM: DDR5 32GB\n- SSD: NVMe 2TB\n\n예산을 알려주시면 더 자세히 추천해드릴게요!`;
        }
        if (lowerMessage.includes('사무') || lowerMessage.includes('문서') || lowerMessage.includes('인터넷')) {
            return `사무용 PC 추천드립니다!\n\n[80만원대 사무용 PC]\n- CPU: Ryzen 5 5600X\n- GPU: 내장 그래픽\n- RAM: DDR4 16GB\n- SSD: 500GB\n\n[120만원대 사무용 PC]\n- CPU: i5-13600K\n- GPU: GTX 1650\n- RAM: DDR4 32GB\n- SSD: 1TB`;
        }
        return '어떤 용도로 PC를 사용하실 예정인가요? (게임/사무/영상편집/프로그래밍 등)';
    }

    if (lowerMessage.includes('중고') || lowerMessage.includes('판매') || lowerMessage.includes('가격')) {
        return '중고 PC 가격 분석을 원하시면 PC 사양을 알려주세요.\n\n예시:\n- CPU: Ryzen 7 7800X3D\n- GPU: RTX 4070 Ti\n- RAM: DDR5 32GB\n- SSD: NVMe 1TB\n- 상태: good\n\nAI가 실시간 시세를 분석해드립니다!';
    }

    if (lowerMessage.includes('비교') || lowerMessage.includes('차이')) {
        return '부품 비교를 도와드릴게요!\n\n예를 들어:\n- RTX 4070 vs RTX 4070 Ti\n- Ryzen 7 vs i7\n- DDR4 vs DDR5\n\n비교하고 싶은 부품을 알려주세요.';
    }

    return '안녕하세요! MYCOM AI입니다.\n\n다음과 같은 도움을 드릴 수 있습니다:\n1. PC 조립 견적 추천\n2. 중고 PC 가격 분석\n3. 부품 성능 비교\n4. 매장 추천\n\n무엇을 도와드릴까요?';
}

module.exports = router;
