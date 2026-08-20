async function showAdminDashboard() {
    if (!currentUser || currentUser.role !== 'shop') {
        showToast('매장 관리자만 접근할 수 있습니다.');
        return;
    }

    try {
        const meData = await api.get('/auth/me');
        const shopId = meData.user.shop_id;

        if (!shopId) {
            showToast('등록된 매장이 없습니다.');
            return;
        }

        const data = await api.get(`/shops/${shopId}/dashboard`);
        renderAdminDashboard(data);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderAdminDashboard(data) {
    const { stats, recentQuotes, recentBids } = data;

    showModal(`
        <h2>📊 매장 관리자 대시보드</h2>
        
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1.5rem 0;">
            <div style="text-align: center; padding: 1rem; background: #eff6ff; border-radius: 8px;">
                <div style="font-size: 2rem; font-weight: 700; color: #2563eb;">${stats.new_quotes || 0}</div>
                <div>새 견적</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: #fef3c7; border-radius: 8px;">
                <div style="font-size: 2rem; font-weight: 700; color: #d97706;">${stats.active_bids || 0}</div>
                <div>진행 입찰</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: #d1fae5; border-radius: 8px;">
                <div style="font-size: 2rem; font-weight: 700; color: #059669;">${stats.today_reservations || 0}</div>
                <div>오늘 예약</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: #fce7f3; border-radius: 8px;">
                <div style="font-size: 2rem; font-weight: 700; color: #db2777;">${stats.chat_rooms || 0}</div>
                <div>채팅방</div>
            </div>
        </div>
        
        <h3>🔥 최근 견적 요청</h3>
        ${recentQuotes.length > 0 ? recentQuotes.map(quote => `
            <div style="padding: 0.75rem; margin-top: 0.5rem; background: #f8fafc; border-radius: 4px;">
                <strong>${quote.title}</strong>
                <p>${quote.user_name} | ${quote.quote_type === 'sell' ? '판매' : '구매'}</p>
                ${quote.cpu ? `<p>CPU: ${quote.cpu}</p>` : ''}
                ${quote.gpu ? `<p>GPU: ${quote.gpu}</p>` : ''}
                <button class="btn btn-primary" onclick="showBidForm('${quote.id}')">입찰하기</button>
            </div>
        `).join('') : '<p>새로운 견적 요청이 없습니다.</p>'}
        
        <h3 style="margin-top: 1.5rem;">💰 최근 입찰</h3>
        ${recentBids.length > 0 ? recentBids.map(bid => `
            <div style="padding: 0.75rem; margin-top: 0.5rem; background: #f8fafc; border-radius: 4px;">
                <strong>${bid.quote_title}</strong>
                <p>${formatPrice(bid.amount)} | ${bid.user_name}</p>
            </div>
        `).join('') : '<p>입찰 내역이 없습니다.</p>'}
    `);
}
