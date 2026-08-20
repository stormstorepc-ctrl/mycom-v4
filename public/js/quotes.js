let currentQuoteType = 'sell';

function switchQuoteTab(type) {
    currentQuoteType = type;
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    loadQuotes();
}

function showQuoteForm() {
    if (!currentUser) {
        showToast('로그인이 필요합니다.');
        showLoginForm();
        return;
    }

    showModal(`
        <h2>${currentQuoteType === 'sell' ? 'PC 판매' : 'PC 구매'} 견적 요청</h2>
        <form onsubmit="createQuote(event)">
            <input type="hidden" name="quote_type" value="${currentQuoteType}">
            <div class="form-group">
                <label>제목</label>
                <input type="text" name="title" required>
            </div>
            <div class="form-group">
                <label>설명</label>
                <textarea name="description" rows="4" required></textarea>
            </div>
            ${currentQuoteType === 'buy' ? `
                <div class="form-group">
                    <label>예산 범위</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="number" name="budget_min" placeholder="최소 금액">
                        <input type="number" name="budget_max" placeholder="최대 금액">
                    </div>
                </div>
            ` : ''}
            <button type="submit" class="btn btn-primary">견적 요청하기</button>
        </form>
    `);
}

async function createQuote(event) {
    event.preventDefault();
    const form = event.target;

    const quoteData = {
        quote_type: form.quote_type.value,
        title: form.title.value,
        description: form.description.value,
        budget_min: form.budget_min?.value ? parseFloat(form.budget_min.value) : null,
        budget_max: form.budget_max?.value ? parseFloat(form.budget_max.value) : null
    };

    try {
        await api.post('/quotes', quoteData);
        closeModal();
        showToast('견적 요청이 등록되었습니다!');
        loadQuotes();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadQuotes() {
    try {
        const data = await api.get(`/quotes?type=${currentQuoteType}&status=open`);
        renderQuotes(data.quotes);
    } catch (error) {
        console.error('견적 목록 로드 오류:', error);
    }
}

function renderQuotes(quotes) {
    const quoteList = document.getElementById('quoteList');
    
    if (quotes.length === 0) {
        quoteList.innerHTML = '<p>등록된 견적 요청이 없습니다.</p>';
        return;
    }

    quoteList.innerHTML = quotes.map(quote => `
        <div class="quote-card">
            <div class="quote-header">
                <span class="quote-type ${quote.quote_type}">${quote.quote_type === 'sell' ? '판매' : '구매'}</span>
                <span>${formatDate(quote.created_at)}</span>
            </div>
            <h3>${quote.title}</h3>
            <p>${quote.description || ''}</p>
            <div style="margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                <span>입찰: ${quote.bid_count || 0}개</span>
                <button class="btn btn-outline" onclick="showQuoteDetail('${quote.id}')">상세보기</button>
            </div>
        </div>
    `).join('');
}

async function showQuoteDetail(quoteId) {
    try {
        const data = await api.get(`/quotes/${quoteId}`);
        const quote = data.quote;
        const bids = data.bids;

        const socket = getSocket();
        if (socket) {
            socket.emit('join-quote', quoteId);
            socket.on('bid-updated', () => {
                showQuoteDetail(quoteId);
                showToast('🔥 새로운 입찰이 등록되었습니다!');
            });
        }

        showModal(`
            <h2>${quote.title}</h2>
            <p>${quote.description || ''}</p>
            <p>작성자: ${quote.user_name}</p>
            <p>상태: ${quote.status}</p>
            
            <h3 style="margin-top: 1.5rem;">입찰 목록 (${bids.length}개)</h3>
            ${bids.length > 0 ? bids.map(bid => `
                <div style="margin-top: 0.5rem; padding: 1rem; background: #f8fafc; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between;">
                        <strong>${bid.shop_name}</strong>
                        <span style="font-size: 1.25rem; font-weight: 700; color: #2563eb;">${formatPrice(bid.amount)}</span>
                    </div>
                    <p>⭐ ${parseFloat(bid.rating || 0).toFixed(1)} | ${bid.address || ''}</p>
                    ${bid.message ? `<p>${bid.message}</p>` : ''}
                    ${currentUser?.role === 'shop' ? `
                        <button class="btn btn-primary" onclick="showBidForm('${quoteId}')">입찰하기</button>
                    ` : ''}
                </div>
            `).join('') : '<p>아직 입찰이 없습니다.</p>'}
            
            ${currentUser?.role === 'shop' ? `
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="showBidForm('${quoteId}')">입찰하기</button>
            ` : ''}
        `);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function showBidForm(quoteId) {
    showModal(`
        <h2>입찰하기</h2>
        <form onsubmit="createBid(event, '${quoteId}')">
            <div class="form-group">
                <label>입찰 금액</label>
                <input type="number" name="amount" required>
            </div>
            <div class="form-group">
                <label>메시지</label>
                <textarea name="message" rows="3"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">입찰 등록</button>
        </form>
    `);
}

async function createBid(event, quoteId) {
    event.preventDefault();
    const form = event.target;

    const bidData = {
        quote_id: quoteId,
        amount: parseFloat(form.amount.value),
        message: form.message.value
    };

    try {
        await api.post('/bids', bidData);
        closeModal();
        showToast('입찰이 등록되었습니다!');
    } catch (error) {
        showToast(error.message, 'error');
    }
}
