document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadShops();
    loadQuotes();
    
    const aiForm = document.getElementById('aiForm');
    if (aiForm) {
        aiForm.addEventListener('submit', handleAIAnalysis);
    }
});

async function handleAIAnalysis(event) {
    event.preventDefault();
    
    if (!currentUser) {
        showToast('로그인이 필요합니다.');
        showLoginForm();
        return;
    }

    const form = event.target;
    const pcData = {
        cpu: form.cpu.value,
        gpu: form.gpu.value,
        ram: form.ram.value,
        storage: form.storage.value,
        condition_grade: form.condition_grade.value
    };

    try {
        const data = await api.post('/ai/analyze-pc', pcData);
        renderAIResult(data.analysis);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderAIResult(analysis) {
    const aiResult = document.getElementById('aiResult');
    
    if (!analysis) {
        aiResult.innerHTML = '<p>분석 결과가 없습니다.</p>';
        return;
    }

    aiResult.innerHTML = `
        <h3>📊 AI 분석 결과</h3>
        <div class="price">${formatPrice(analysis.estimatedPrice)}</div>
        <p>예상 가격 범위: ${formatPrice(analysis.priceRange?.min)} ~ ${formatPrice(analysis.priceRange?.max)}</p>
        
        <div class="confidence">
            <p>신뢰도: ${analysis.confidence}%</p>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${analysis.confidence}%;"></div>
            </div>
        </div>
        
        ${analysis.factors?.length > 0 ? `
            <h4 style="margin-top: 1rem;">가격 영향 요인</h4>
            ${analysis.factors.map(factor => `
                <p>${factor.type === 'positive' ? '▲' : '▼'} ${factor.component}: ${factor.value} (${factor.impact})</p>
            `).join('')}
        ` : ''}
    `;
}

async function sendAIChat(message) {
    try {
        const data = await api.post('/ai/chat', { message });
        return data.response;
    } catch (error) {
        return '죄송합니다. AI 응답 중 오류가 발생했습니다.';
    }
}
