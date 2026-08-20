let currentUser = null;

function checkAuth() {
    const token = api.getToken();
    if (!token) {
        showAuthButtons();
        return;
    }

    api.get('/auth/me')
        .then(data => {
            currentUser = data.user;
            showUserInfo();
            connectSocket();
        })
        .catch(() => {
            api.setToken(null);
            showAuthButtons();
        });
}

function showAuthButtons() {
    const authButtons = document.getElementById('authButtons');
    authButtons.innerHTML = `
        <button class="btn btn-outline" onclick="showLoginForm()">로그인</button>
        <button class="btn btn-primary" onclick="showRegisterForm()">회원가입</button>
    `;
}

function showUserInfo() {
    const authButtons = document.getElementById('authButtons');
    const roleLabel = currentUser.role === 'shop' ? '매장' : currentUser.role === 'admin' ? '관리자' : '사용자';
    
    authButtons.innerHTML = `
        <span class="user-name">${currentUser.name} (${roleLabel})</span>
        <button class="btn btn-outline" onclick="logout()">로그아웃</button>
    `;

    if (currentUser.role === 'shop') {
        const nav = document.querySelector('.nav');
        if (!document.querySelector('.admin-link')) {
            const adminLink = document.createElement('a');
            adminLink.href = '#admin';
            adminLink.className = 'admin-link';
            adminLink.textContent = '매장 관리';
            adminLink.onclick = showAdminDashboard;
            nav.appendChild(adminLink);
        }
    }
}

function showLoginForm() {
    showModal(`
        <h2>로그인</h2>
        <form onsubmit="login(event)">
            <div class="form-group">
                <label>이메일</label>
                <input type="email" name="email" required>
            </div>
            <div class="form-group">
                <label>비밀번호</label>
                <input type="password" name="password" required>
            </div>
            <button type="submit" class="btn btn-primary">로그인</button>
        </form>
        <p style="margin-top: 1rem;">
            계정이 없으신가요? <a href="#" onclick="showRegisterForm()">회원가입</a>
        </p>
    `);
}

function showRegisterForm() {
    showModal(`
        <h2>회원가입</h2>
        <form onsubmit="register(event)">
            <div class="form-group">
                <label>이름</label>
                <input type="text" name="name" required>
            </div>
            <div class="form-group">
                <label>이메일</label>
                <input type="email" name="email" required>
            </div>
            <div class="form-group">
                <label>비밀번호 (8자 이상)</label>
                <input type="password" name="password" minlength="8" required>
            </div>
            <div class="form-group">
                <label>전화번호</label>
                <input type="tel" name="phone">
            </div>
            <button type="submit" class="btn btn-primary">가입하기</button>
        </form>
        <p style="margin-top: 1rem;">
            매장이신가요? <a href="#" onclick="showShopRegisterForm()">매장 회원가입</a>
        </p>
    `);
}

function showShopRegisterForm() {
    showModal(`
        <h2>매장 회원가입</h2>
        <form onsubmit="registerShop(event)">
            <div class="form-group">
                <label>담당자 이름</label>
                <input type="text" name="name" required>
            </div>
            <div class="form-group">
                <label>이메일</label>
                <input type="email" name="email" required>
            </div>
            <div class="form-group">
                <label>비밀번호 (8자 이상)</label>
                <input type="password" name="password" minlength="8" required>
            </div>
            <div class="form-group">
                <label>매장명</label>
                <input type="text" name="shop_name" required>
            </div>
            <div class="form-group">
                <label>사업자번호</label>
                <input type="text" name="business_number" required>
            </div>
            <div class="form-group">
                <label>주소</label>
                <input type="text" name="address" required>
            </div>
            <div class="form-group">
                <label>상세주소</label>
                <input type="text" name="detail_address">
            </div>
            <div class="form-group">
                <label>매장 전화번호</label>
                <input type="tel" name="shop_phone">
            </div>
            <div class="form-group">
                <label>매장 소개</label>
                <textarea name="description" rows="3"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">매장 등록하기</button>
        </form>
    `);
}

async function login(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value;
    const password = form.password.value;

    try {
        const data = await api.post('/auth/login', { email, password });
        api.setToken(data.token);
        currentUser = data.user;
        closeModal();
        showUserInfo();
        connectSocket();
        showToast('로그인 성공!');
        loadShops();
        loadQuotes();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function register(event) {
    event.preventDefault();
    const form = event.target;
    const userData = {
        name: form.name.value,
        email: form.email.value,
        password: form.password.value,
        phone: form.phone.value,
        role: 'user'
    };

    try {
        const data = await api.post('/auth/register', userData);
        api.setToken(data.token);
        currentUser = data.user;
        closeModal();
        showUserInfo();
        connectSocket();
        showToast('회원가입 완료!');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function registerShop(event) {
    event.preventDefault();
    const form = event.target;
    const shopData = {
        name: form.name.value,
        email: form.email.value,
        password: form.password.value,
        shop_name: form.shop_name.value,
        business_number: form.business_number.value,
        address: form.address.value,
        detail_address: form.detail_address.value,
        shop_phone: form.shop_phone.value,
        description: form.description.value
    };

    try {
        const data = await api.post('/auth/register-shop', shopData);
        api.setToken(data.token);
        currentUser = data.user;
        closeModal();
        showUserInfo();
        connectSocket();
        showToast('매장 회원가입 완료! 관리자 승인을 기다려주세요.');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function logout() {
    api.setToken(null);
    currentUser = null;
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    showAuthButtons();
    showToast('로그아웃되었습니다.');
}
