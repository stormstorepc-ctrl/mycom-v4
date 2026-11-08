// 인메모리 가짜 DB로 PUT /api/reservations/:id/status 검증 (운영 DB 미사용)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const express = require('express');

const state = { reservation: { id: 1, user_id: 10, shop_id: 3, status: 'cancelled' } };
const fakeDb = { query: async (sql, p = []) => {
  if (/^SELECT \* FROM reservations WHERE id/.test(sql)) return { rows: [state.reservation] };
  if (/^SELECT user_id FROM shops/.test(sql)) return { rows: [{ user_id: 20 }] };
  if (/^UPDATE reservations SET status/.test(sql)) { state.reservation.status = p[0]; return { rows: [state.reservation] }; }
  if (/^INSERT INTO notifications/.test(sql)) return { rows: [] };
  throw new Error('unexpected sql: ' + sql);
} };
const mock = (rel, exports) => { const f = require.resolve(path.join('..', rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
mock('services/database.js', fakeDb);
mock('middleware/auth.js', { authenticate: (req, res, next) => { req.user = { id: 20, role: 'shop' }; next(); }, authorize: () => (q, r, n) => n() });

async function put(status) {
  const app = express(); app.use(express.json()); app.use('/api/reservations', require('../routes/reservations'));
  const server = app.listen(0);
  try { return await fetch(`http://127.0.0.1:${server.address().port}/api/reservations/1/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); } finally { server.close(); }
}
test('취소된 예약은 다시 확정할 수 없다', async () => { state.reservation.status = 'cancelled'; assert.strictEqual((await put('confirmed')).status, 409); assert.strictEqual(state.reservation.status, 'cancelled'); });
test('완료된 예약은 취소로 바꿀 수 없다', async () => { state.reservation.status = 'completed'; assert.strictEqual((await put('cancelled')).status, 409); });
test('대기 예약은 확정 가능', async () => { state.reservation.status = 'pending'; assert.strictEqual((await put('confirmed')).status, 200); });
