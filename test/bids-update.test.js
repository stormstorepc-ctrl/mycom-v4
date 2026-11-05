// 인메모리 가짜 DB로 PUT /api/bids/:id 검증 (운영 DB 미사용)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const express = require('express');
const state = { quote: { status: 'bidding', budget_max: 1000000 }, bid: { id: 1, quote_id: 1, user_id: 5, amount: 900000, is_selected: false } };
const fakeDb = { query: async (sql, p = []) => {
  if (/^SELECT b\.\*,s\.user_id FROM bids/.test(sql)) return { rows: [state.bid] };
  if (/^SELECT status,budget_max FROM quotes/.test(sql)) return { rows: [state.quote] };
  if (/^UPDATE bids SET amount/.test(sql)) { state.bid.amount = p[0] ?? state.bid.amount; return { rows: [state.bid] }; }
  throw new Error('unexpected sql: ' + sql);
} };
const mock = (rel, exports) => { const f = require.resolve(path.join('..', rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
mock('services/database.js', fakeDb);
mock('services/socket.js', { getIO: () => null });
mock('middleware/auth.js', { authenticate: (req, res, next) => { req.user = { id: 5, role: 'shop' }; next(); }, authorize: () => (q, r, n) => n() });
async function put(body) {
  const app = express(); app.use(express.json()); app.use('/api/bids', require('../routes/bids'));
  const server = app.listen(0);
  try { return await fetch(`http://127.0.0.1:${server.address().port}/api/bids/1`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } finally { server.close(); }
}
test('정상 수정은 허용', async () => { state.quote.status = 'bidding'; state.bid.is_selected = false; assert.strictEqual((await put({ amount: 800000 })).status, 200); });
test('희망 최대 금액 초과 수정 거부', async () => { assert.strictEqual((await put({ amount: 2000000 })).status, 400); });
test('마감된 견적의 입찰 수정 거부', async () => { state.quote.status = 'closed'; assert.strictEqual((await put({ amount: 700000 })).status, 400); });
test('이미 선택된 입찰 수정 거부', async () => { state.quote.status = 'selected'; state.bid.is_selected = true; assert.strictEqual((await put({ amount: 100 })).status, 400); });
