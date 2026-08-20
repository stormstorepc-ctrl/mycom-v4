let currentRoomId = null;
let chatSocket = null;

async function startChat(shopId) {
    if (!currentUser) {
        showToast('로그인이 필요합니다.');
        showLoginForm();
        return;
    }

    try {
        const data = await api.post('/chat/rooms', { shop_id: shopId });
        openChatRoom(data.room.id);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function openChatRoom(roomId) {
    currentRoomId = roomId;
    
    const socket = getSocket();
    if (socket) {
        socket.emit('join-chat', roomId);
        chatSocket = socket;
        
        socket.on('new-message', (message) => {
            if (message.room_id === currentRoomId) {
                appendMessage(message);
            }
        });
    }

    loadMessages(roomId);
    loadChatRooms();
}

async function loadChatRooms() {
    if (!currentUser) return;

    try {
        const data = await api.get('/chat/rooms');
        renderChatRooms(data.rooms);
    } catch (error) {
        console.error('채팅방 목록 로드 오류:', error);
    }
}

function renderChatRooms(rooms) {
    const chatContainer = document.getElementById('chatContainer');
    
    if (rooms.length === 0) {
        chatContainer.innerHTML = '<p>채팅방이 없습니다.</p>';
        return;
    }

    chatContainer.innerHTML = `
        <div class="chat-rooms">
            ${rooms.map(room => `
                <div class="chat-room-item ${room.id === currentRoomId ? 'active' : ''}" 
                     onclick="openChatRoom('${room.id}')">
                    <strong>${room.other_party_name || room.shop_name}</strong>
                    ${room.unread_count > 0 ? `<span style="color: red;">(${room.unread_count})</span>` : ''}
                    ${room.last_message ? `<p style="font-size: 0.875rem; color: #64748b;">${room.last_message}</p>` : ''}
                </div>
            `).join('')}
        </div>
        <div class="chat-messages" id="chatMessages">
            <p>채팅방을 선택하세요.</p>
        </div>
        <div class="chat-input" style="display: none;" id="chatInput">
            <input type="text" id="messageInput" placeholder="메시지를 입력하세요...">
            <button class="btn btn-primary" onclick="sendMessage()">전송</button>
        </div>
    `;
}

async function loadMessages(roomId) {
    try {
        const data = await api.get(`/chat/rooms/${roomId}/messages`);
        renderMessages(data.messages);
    } catch (error) {
        console.error('메시지 로드 오류:', error);
    }
}

function renderMessages(messages) {
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    
    if (chatMessages) {
        chatMessages.innerHTML = messages.map(message => `
            <div class="message ${message.sender_id === currentUser?.id ? 'sent' : 'received'}">
                <strong>${message.sender_name || '알 수 없음'}</strong>
                <p>${message.message}</p>
                <small>${formatTime(message.created_at)}</small>
            </div>
        `).join('');
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    if (chatInput) {
        chatInput.style.display = 'flex';
    }
}

function appendMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    
    if (chatMessages) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender_id === currentUser?.id ? 'sent' : 'received'}`;
        messageElement.innerHTML = `
            <strong>${message.sender_name || '알 수 없음'}</strong>
            <p>${message.message}</p>
            <small>${formatTime(message.created_at)}</small>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || !currentRoomId) return;
    
    try {
        if (chatSocket && chatSocket.connected) {
            chatSocket.emit('send-message', {
                roomId: currentRoomId,
                message
            });
        } else {
            await api.post(`/chat/rooms/${currentRoomId}/messages`, { message });
        }
        
        input.value = '';
    } catch (error) {
        showToast(error.message, 'error');
    }
}
