let userLocation = null;

function getLocation() {
    if (!navigator.geolocation) {
        showToast('위치 정보를 지원하지 않는 브라우저입니다.', 'error');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            document.getElementById('locationStatus').textContent = 
                `📍 현재 위치: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
            loadShops();
        },
        (error) => {
            showToast('위치를 가져올 수 없습니다.', 'error');
        }
    );
}

async function loadShops() {
    try {
        let endpoint = '/shops';
        
        if (userLocation) {
            endpoint += `?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&radius=10&sort=distance`;
        }

        const data = await api.get(endpoint);
        renderShops(data.shops);
    } catch (error) {
        console.error('매장 목록 로드 오류:', error);
    }
}

function renderShops(shops) {
    const shopList = document.getElementById('shopList');
    
    if (shops.length === 0) {
        shopList.innerHTML = '<p>등록된 매장이 없습니다.</p>';
        return;
    }

    shopList.innerHTML = shops.map(shop => `
        <div class="shop-card">
            <h3>${shop.shop_name}</h3>
            <div class="rating">⭐ ${parseFloat(shop.avg_rating || 0).toFixed(1)} (${shop.review_count || 0}개 리뷰)</div>
            ${shop.distance ? `<div class="distance">📍 ${parseFloat(shop.distance).toFixed(1)}km</div>` : ''}
            <p>${shop.address || ''}</p>
            <p>${shop.phone || ''}</p>
            <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                <button class="btn btn-outline" onclick="showShopDetail('${shop.id}')">상세보기</button>
                <button class="btn btn-primary" onclick="showReservationForm('${shop.id}')">예약하기</button>
            </div>
        </div>
    `).join('');
}

async function showShopDetail(shopId) {
    try {
        const data = await api.get(`/shops/${shopId}`);
        const shop = data.shop;
        const reviews = data.reviews;

        showModal(`
            <h2>${shop.shop_name}</h2>
            <div class="rating">⭐ ${parseFloat(shop.avg_rating).toFixed(1)} (${shop.review_count}개 리뷰)</div>
            <p>📍 ${shop.address} ${shop.detail_address || ''}</p>
            <p>📞 ${shop.phone || '전화번호 없음'}</p>
            <p>${shop.description || ''}</p>
            
            <h3 style="margin-top: 1.5rem;">최근 리뷰</h3>
            ${reviews.length > 0 ? reviews.map(review => `
                <div style="margin-top: 0.5rem; padding: 0.5rem; background: #f8fafc; border-radius: 4px;">
                    <strong>${review.user_name}</strong> ⭐ ${review.rating}
                    <p>${review.content || ''}</p>
                </div>
            `).join('') : '<p>아직 리뷰가 없습니다.</p>'}
            
            <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem;">
                <button class="btn btn-primary" onclick="showReservationForm('${shop.id}')">예약하기</button>
                <button class="btn btn-outline" onclick="startChat('${shop.id}')">채팅하기</button>
            </div>
        `);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function showReservationForm(shopId) {
    if (!currentUser) {
        showToast('로그인이 필요합니다.');
        showLoginForm();
        return;
    }

    const today = new Date().toISOString().split('T')[0];

    showModal(`
        <h2>예약하기</h2>
        <form onsubmit="createReservation(event, '${shopId}')">
            <div class="form-group">
                <label>날짜</label>
                <input type="date" name="reservation_date" min="${today}" required>
            </div>
            <div class="form-group">
                <label>시간</label>
                <select name="reservation_time" required>
                    <option value="10:00">10:00</option>
                    <option value="11:00">11:00</option>
                    <option value="13:00">13:00</option>
                    <option value="14:00">14:00</option>
                    <option value="15:00">15:00</option>
                    <option value="16:00">16:00</option>
                    <option value="17:00">17:00</option>
                </select>
            </div>
            <div class="form-group">
                <label>서비스</label>
                <select name="service_type" required>
                    <option value="PC 조립">PC 조립</option>
                    <option value="수리">수리</option>
                    <option value="업그레이드">업그레이드</option>
                    <option value="중고 검수">중고 검수</option>
                    <option value="상담">상담</option>
                </select>
            </div>
            <div class="form-group">
                <label>메모</label>
                <textarea name="notes" rows="3"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">예약하기</button>
        </form>
    `);
}

async function createReservation(event, shopId) {
    event.preventDefault();
    const form = event.target;

    const reservationData = {
        shop_id: shopId,
        reservation_date: form.reservation_date.value,
        reservation_time: form.reservation_time.value,
        service_type: form.service_type.value,
        notes: form.notes.value
    };

    try {
        await api.post('/reservations', reservationData);
        closeModal();
        showToast('예약이 완료되었습니다!');
    } catch (error) {
        showToast(error.message, 'error');
    }
}
