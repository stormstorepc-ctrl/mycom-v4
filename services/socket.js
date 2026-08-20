const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./database');

let io;

function initSocket(server) {
    io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('인증이 필요합니다.'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const result = await db.query(
                'SELECT id, email, name, role FROM users WHERE id = $1',
                [decoded.userId]
            );

            if (result.rows.length === 0) {
                return next(new Error('사용자를 찾을 수 없습니다.'));
            }

            socket.user = result.rows[0];
            next();
        } catch (error) {
            next(new Error('인증 실패'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 소켓 연결: ${socket.user.name} (${socket.user.role})`);

        socket.on('join-quote', (quoteId) => {
            socket.join(`quote-${quoteId}`);
        });

        socket.on('leave-quote', (quoteId) => {
            socket.leave(`quote-${quoteId}`);
        });

        socket.on('join-chat', (roomId) => {
            socket.join(`chat-${roomId}`);
        });

        socket.on('leave-chat', (roomId) => {
            socket.leave(`chat-${roomId}`);
        });

        socket.on('send-message', async (data) => {
            try {
                const { roomId, message } = data;
                
                const result = await db.query(
                    `INSERT INTO messages (room_id, sender_id, sender_type, message) 
                     VALUES ($1, $2, $3, $4) 
                     RETURNING *`,
                    [roomId, socket.user.id, socket.user.role === 'shop' ? 'shop' : 'user', message]
                );

                const newMessage = result.rows[0];
                newMessage.sender_name = socket.user.name;

                io.to(`chat-${roomId}`).emit('new-message', newMessage);
            } catch (error) {
                console.error('메시지 전송 오류:', error);
                socket.emit('error', { message: '메시지 전송 실패' });
            }
        });

        socket.on('new-bid', async (data) => {
            try {
                const { quoteId, amount, message } = data;
                
                const shopResult = await db.query(
                    'SELECT id FROM shops WHERE user_id = $1 AND is_approved = TRUE',
                    [socket.user.id]
                );

                if (shopResult.rows.length === 0) {
                    return socket.emit('error', { message: '승인된 매장이 아닙니다.' });
                }

                const shopId = shopResult.rows[0].id;

                const result = await db.query(
                    `INSERT INTO bids (quote_id, shop_id, amount, message) 
                     VALUES ($1, $2, $3, $4) 
                     RETURNING *`,
                    [quoteId, shopId, amount, message]
                );

                const newBid = result.rows[0];

                await db.query(
                    'UPDATE quotes SET status = $1, updated_at = NOW() WHERE id = $2',
                    ['bidding', quoteId]
                );

                const shopInfo = await db.query(
                    'SELECT shop_name, rating FROM shops WHERE id = $1',
                    [shopId]
                );

                newBid.shop_name = shopInfo.rows[0]?.shop_name;
                newBid.shop_rating = shopInfo.rows[0]?.rating;

                io.to(`quote-${quoteId}`).emit('bid-updated', newBid);
                
                const quoteResult = await db.query(
                    'SELECT user_id, title FROM quotes WHERE id = $1',
                    [quoteId]
                );

                if (quoteResult.rows.length > 0) {
                    await db.query(
                        `INSERT INTO notifications (user_id, type, title, message, link) 
                         VALUES ($1, $2, $3, $4, $5)`,
                        [
                            quoteResult.rows[0].user_id,
                            'new_bid',
                            '새로운 입찰',
                            `"${quoteResult.rows[0].title}"에 새로운 입찰이 등록되었습니다.`,
                            `/quotes/${quoteId}`
                        ]
                    );
                }
            } catch (error) {
                console.error('입찰 등록 오류:', error);
                socket.emit('error', { message: '입찰 등록 실패' });
            }
        });

        socket.on('disconnect', () => {
            console.log(`🔌 소켓 연결 해제: ${socket.user?.name}`);
        });
    });

    return io;
}

function getIO() {
    return io;
}

module.exports = { initSocket, getIO };
