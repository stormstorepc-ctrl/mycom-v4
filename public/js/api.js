const API_BASE = '/api';

class APIClient {
    constructor() {
        this.token = localStorage.getItem('mycom_token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('mycom_token', token);
        } else {
            localStorage.removeItem('mycom_token');
        }
    }

    getToken() {
        return this.token;
    }

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '요청 중 오류가 발생했습니다.');
        }

        return data;
    }

    get(endpoint) {
        return this.request(endpoint);
    }

    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
}

const api = new APIClient();

let socket = null;

function connectSocket() {
    const token = api.getToken();
    if (!token) return null;

    socket = io({
        auth: { token }
    });

    socket.on('connect', () => {
        console.log('🔌 Socket.IO 연결됨');
    });

    socket.on('disconnect', () => {
        console.log('🔌 Socket.IO 연결 해제');
    });

    socket.on('error', (error) => {
        console.error('Socket.IO 오류:', error);
        showToast(error.message || '소켓 오류가 발생했습니다.');
    });

    return socket;
}

function getSocket() {
    if (!socket || !socket.connected) {
        return connectSocket();
    }
    return socket;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showModal(content) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = content;
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.style.display = 'none';
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(timeString) {
    if (!timeString) return '';
    return timeString.slice(0, 5);
}

function formatPrice(price) {
    if (!price) return '0원';
    return price.toLocaleString('ko-KR') + '원';
}
