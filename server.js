require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initSocket } = require('./services/socket');
const initDatabase = require('./database/init');

const authRoutes = require('./routes/auth');
const shopRoutes = require('./routes/shops');
const quoteRoutes = require('./routes/quotes');
const bidRoutes = require('./routes/bids');
const reservationRoutes = require('./routes/reservations');
const chatRoutes = require('./routes/chat');
const aiRoutes = require('./routes/ai');
const partnerRoutes = require('./routes/partner');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/partner', partnerRoutes);

app.get('/api/health', (req, res) => res.json({ status:'ok', service:'MYCOM V4', timestamp:new Date().toISOString() }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, req, res, next) => { console.error('서버 오류:', err); res.status(500).json({ error:'서버 내부 오류가 발생했습니다.' }); });

const PORT = process.env.PORT || 3000;
async function startServer() {
  try { await initDatabase(); console.log('✅ 데이터베이스 연결 완료'); initSocket(server); console.log('✅ Socket.IO 초기화 완료'); server.listen(PORT,()=>console.log(`🚀 MYCOM V4 서버가 포트 ${PORT}에서 실행 중입니다.`)); }
  catch(error){ console.error('❌ 서버 시작 실패:',error); process.exit(1); }
}
startServer();
