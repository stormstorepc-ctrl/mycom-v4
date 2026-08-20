const express = require('express');
const db = require('../services/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('shop'));

async function getShop(userId) {
  const result = await db.query('SELECT * FROM shops WHERE user_id = $1 LIMIT 1', [userId]);
  return result.rows[0] || null;
}

router.get('/dashboard', async (req, res) => {
  try {
    const shop = await getShop(req.user.id);
    if (!shop) return res.status(404).json({ error: '등록된 매장이 없습니다.' });
    const [openQuotes, bids, reservations, unread, sales, recent] = await Promise.all([
      db.query(`SELECT COUNT(*)::int count FROM quotes WHERE status IN ('open','bidding') AND (expires_at IS NULL OR expires_at > NOW())`),
      db.query(`SELECT COUNT(*)::int count FROM bids WHERE shop_id=$1 AND is_selected=false`, [shop.id]),
      db.query(`SELECT COUNT(*)::int count FROM reservations WHERE shop_id=$1 AND reservation_date=CURRENT_DATE AND status IN ('pending','confirmed')`, [shop.id]),
      db.query(`SELECT COUNT(*)::int count FROM messages m JOIN chat_rooms c ON c.id=m.room_id WHERE c.shop_id=$1 AND m.sender_type='user' AND m.is_read=false`, [shop.id]),
      db.query(`SELECT COALESCE(SUM(b.amount),0)::numeric sales, COUNT(*)::int count FROM bids b WHERE b.shop_id=$1 AND b.is_selected=true AND date_trunc('month',b.updated_at)=date_trunc('month',NOW())`, [shop.id]),
      db.query(`SELECT q.id,q.title,q.quote_type,q.budget_min,q.budget_max,q.status,q.created_at,p.cpu,p.gpu,p.ram,p.storage FROM quotes q LEFT JOIN pcs p ON p.id=q.pc_id WHERE q.status IN ('open','bidding') AND (q.expires_at IS NULL OR q.expires_at>NOW()) ORDER BY q.created_at DESC LIMIT 8`)
    ]);
    res.json({ shop, stats:{open_quotes:openQuotes.rows[0].count, active_bids:bids.rows[0].count, today_reservations:reservations.rows[0].count, unread_messages:unread.rows[0].count, month_sales:Number(sales.rows[0].sales), completed_sales:sales.rows[0].count}, recent_quotes:recent.rows });
  } catch (error) { console.error(error); res.status(500).json({error:'대시보드를 불러오지 못했습니다.'}); }
});

router.get('/quotes', async (req,res)=>{
  try {
    const shop=await getShop(req.user.id); if(!shop) return res.status(404).json({error:'등록된 매장이 없습니다.'});
    const result=await db.query(`SELECT q.id,q.title,q.quote_type,q.description,q.budget_min,q.budget_max,q.status,q.expires_at,q.created_at,p.cpu,p.gpu,p.ram,p.storage, EXISTS(SELECT 1 FROM bids b WHERE b.quote_id=q.id AND b.shop_id=$1) AS my_bid FROM quotes q LEFT JOIN pcs p ON p.id=q.pc_id WHERE q.status IN ('open','bidding') AND (q.expires_at IS NULL OR q.expires_at>NOW()) ORDER BY q.created_at DESC`,[shop.id]);
    res.json({quotes:result.rows});
  } catch(e){console.error(e);res.status(500).json({error:'견적을 불러오지 못했습니다.'});}
});

router.get('/bids', async(req,res)=>{try{const shop=await getShop(req.user.id);if(!shop)return res.status(404).json({error:'등록된 매장이 없습니다.'});const r=await db.query(`SELECT b.*,q.title,q.quote_type,q.status,q.budget_min,q.budget_max FROM bids b JOIN quotes q ON q.id=b.quote_id WHERE b.shop_id=$1 ORDER BY b.updated_at DESC`,[shop.id]);res.json({bids:r.rows});}catch(e){console.error(e);res.status(500).json({error:'입찰 내역을 불러오지 못했습니다.'});}});

router.get('/reservations', async(req,res)=>{try{const shop=await getShop(req.user.id);if(!shop)return res.status(404).json({error:'등록된 매장이 없습니다.'});const r=await db.query(`SELECT r.*,u.name,u.phone,q.title FROM reservations r JOIN users u ON u.id=r.user_id LEFT JOIN quotes q ON q.id=r.quote_id WHERE r.shop_id=$1 ORDER BY r.reservation_date ASC,r.reservation_time ASC LIMIT 100`,[shop.id]);res.json({reservations:r.rows});}catch(e){console.error(e);res.status(500).json({error:'예약을 불러오지 못했습니다.'});}});

router.patch('/reservations/:id', async(req,res)=>{try{const shop=await getShop(req.user.id);const status=req.body.status;if(!['pending','confirmed','completed','cancelled'].includes(status))return res.status(400).json({error:'잘못된 상태입니다.'});const r=await db.query(`UPDATE reservations SET status=$1,updated_at=NOW() WHERE id=$2 AND shop_id=$3 RETURNING *`,[status,req.params.id,shop.id]);if(!r.rows.length)return res.status(404).json({error:'예약을 찾을 수 없습니다.'});res.json({reservation:r.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'예약 상태 변경 실패'});}});

router.get('/messages', async(req,res)=>{try{const shop=await getShop(req.user.id);if(!shop)return res.status(404).json({error:'등록된 매장이 없습니다.'});const r=await db.query(`SELECT c.id,c.quote_id,u.name customer_name,MAX(m.created_at) last_at,COUNT(*) FILTER(WHERE m.sender_type='user' AND m.is_read=false)::int unread,COALESCE((ARRAY_AGG(m.message ORDER BY m.created_at DESC))[1],'') last_message FROM chat_rooms c JOIN users u ON u.id=c.user_id LEFT JOIN messages m ON m.room_id=c.id WHERE c.shop_id=$1 GROUP BY c.id,c.quote_id,u.name ORDER BY last_at DESC NULLS LAST`,[shop.id]);res.json({rooms:r.rows});}catch(e){console.error(e);res.status(500).json({error:'상담 목록을 불러오지 못했습니다.'});}});

router.get('/shop',async(req,res)=>{try{const shop=await getShop(req.user.id);if(!shop)return res.status(404).json({error:'등록된 매장이 없습니다.'});res.json({shop});}catch(e){res.status(500).json({error:'매장 정보를 불러오지 못했습니다.'});}});
router.put('/shop',async(req,res)=>{try{const shop=await getShop(req.user.id);if(!shop)return res.status(404).json({error:'등록된 매장이 없습니다.'});const {shop_name,address,detail_address,latitude,longitude,phone,description}=req.body;const r=await db.query(`UPDATE shops SET shop_name=COALESCE($1,shop_name),address=COALESCE($2,address),detail_address=COALESCE($3,detail_address),latitude=COALESCE($4,latitude),longitude=COALESCE($5,longitude),phone=COALESCE($6,phone),description=COALESCE($7,description),updated_at=NOW() WHERE id=$8 RETURNING *`,[shop_name,address,detail_address,latitude,longitude,phone,description,shop.id]);res.json({shop:r.rows[0],message:'매장 정보가 저장되었습니다.'});}catch(e){console.error(e);res.status(500).json({error:'매장 정보 저장 실패'});}});

module.exports=router;