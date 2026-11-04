// 임시 인메모리 가짜 DB로 PUT /api/quotes/:id/status 를 검증합니다. (운영 DB 미사용)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const express = require('express');

const state = { quotes: [{ id: 1, user_id: 10 }], bids: [{ id: 1, quote_id: 1, is_selected: true }, { id: 2, quote_id: 1, is_selected: false }] };
const fakeDb = {
  query: async (sql, p = []) => {
    if (/^SELECT user_id FROM quotes/.test(sql)) return { rows: state.quotes.filter(q => q.id == p[0]) };
    if (/^SELECT id FROM bids WHERE id=\$1 AND quote_id=\$2/.test(sql)) return { rows: state.bids.filter(b => b.id == p[0] && b.quote_id == p[1]) };
    if (/^UPDATE quotes SET status/.test(sql)) return { rows: [{ id: p[2], status: p[0], selected_bid_id: p[1] }] };
    if (/^UPDATE bids SET is_selected=FALSE WHERE quote_id=\$1/.test(sql)) { state.bids.filter(b => b.quote_id == p[0]).forEach(b => b.is_selected = false); return { rows: [] }; }
    if (/^UPDATE bids SET is_selected=TRUE WHERE id=\$1/.test(sql)) { state.bids.filter(b => b.id == p[0]).forEach(b => b.is_selected = true); return { rows: [] }; }
    throw new Error('unexpected sql: ' + sql);
  },
};
const mock = (rel, exports) => { const f = require.resolve(path.join('..', rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
mock('services/database.js', fakeDb);
mock('middleware/auth.js', { authenticate: (req, res, next) => { req.user = { id: 10, role: 'user' }; next(); }, authorize: () => (q, r, n) => n() });

test('입찰 선택을 바꾸면 이전 선택이 해제되어 한 입찰만 선택 상태', async () => {
  const app = express(); app.use(express.json()); app.use('/api/quotes', require('../routes/quotes'));
  const server = app.listen(0); const port = server.address().port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/quotes/1/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'selected', selected_bid_id: 2 }) });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(state.bids.filter(b => b.is_selected).map(b => b.id), [2]);
  } finally { server.close(); }
});
