const express = require('express');
const db = require('../services/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.post('/', authenticate, async (req, res) => {
  try {
    const { shop_id, quote_id, bid_id, reservation_date, reservation_time, service_type, notes } = req.body;
    if (!shop_id || !reservation_date || !reservation_time || !service_type) return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
    const shopResult = await db.query('SELECT id,user_id,shop_name,is_approved,is_active FROM shops WHERE id=$1',[shop_id]);
    if (!shopResult.rows.length || !shopResult.rows[0].is_approved || shopResult.rows[0].is_active === false) return res.status(404).json({ error: '예약 가능한 업체가 아닙니다.' });
    const dateOnly = String(reservation_date).slice(0,10);
    const today = new Date().toISOString().slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly) || dateOnly < today) return res.status(400).json({ error: '지난 날짜에는 예약할 수 없습니다.' });
    if (quote_id) {
      const q = await db.query('SELECT id,user_id,status FROM quotes WHERE id=$1',[quote_id]);
      if (!q.rows.length || q.rows[0].user_id !== req.user.id) return res.status(403).json({ error: '해당 견적에 예약할 권한이 없습니다.' });
    }
    if (bid_id) {
      const b = await db.query('SELECT b.id,b.quote_id,b.shop_id,q.user_id,q.status FROM bids b JOIN quotes q ON q.id=b.quote_id WHERE b.id=$1',[bid_id]);
      if (!b.rows.length || b.rows[0].shop_id !== shop_id || b.rows[0].user_id !== req.user.id || !['open','bidding'].includes(b.rows[0].status)) return res.status(403).json({ error: '선택한 입찰과 예약 정보가 일치하지 않습니다.' });
      if (quote_id && b.rows[0].quote_id !== quote_id) return res.status(400).json({ error: '견적과 입찰 정보가 일치하지 않습니다.' });
    }
    const existing = await db.query(`SELECT id FROM reservations WHERE shop_id=$1 AND reservation_date=$2 AND reservation_time=$3 AND status!='cancelled'`,[shop_id,dateOnly,reservation_time]);
    if (existing.rows.length) return res.status(409).json({ error: '해당 시간에 이미 예약이 있습니다.' });
    const result = await db.query(`INSERT INTO reservations(user_id,shop_id,quote_id,bid_id,reservation_date,reservation_time,service_type,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[req.user.id,shop_id,quote_id||null,bid_id||null,dateOnly,reservation_time,service_type,notes||null]);
    await db.query(`INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)`,[shopResult.rows[0].user_id,'new_reservation','새로운 예약',`${dateOnly} ${reservation_time}에 ${service_type} 예약이 접수되었습니다.`,`/partner.html`]);
    res.status(201).json({ message:'예약이 완료되었습니다.', reservation:result.rows[0] });
  } catch (error) { console.error('예약 생성 오류:', error); res.status(500).json({error:'예약 생성 중 오류가 발생했습니다.'}); }
});

router.get('/my', authenticate, async (req,res)=>{try{const r=await db.query(`SELECT r.*,s.shop_name,s.address,s.phone FROM reservations r JOIN shops s ON s.id=r.shop_id WHERE r.user_id=$1 ORDER BY r.reservation_date DESC,r.reservation_time DESC`,[req.user.id]);res.json({reservations:r.rows})}catch(e){console.error(e);res.status(500).json({error:'예약 목록 조회 오류'})}});

router.get('/shop/:shopId',authenticate,authorize('shop','admin'),async(req,res)=>{try{const{shopId}=req.params;if(req.user.role==='shop'){const s=await db.query('SELECT user_id FROM shops WHERE id=$1',[shopId]);if(!s.rows.length||s.rows[0].user_id!==req.user.id)return res.status(403).json({error:'예약 목록 조회 권한이 없습니다.'})}const r=await db.query(`SELECT r.*,u.name user_name,u.phone user_phone FROM reservations r JOIN users u ON u.id=r.user_id WHERE r.shop_id=$1 ORDER BY r.reservation_date DESC,r.reservation_time DESC`,[shopId]);res.json({reservations:r.rows})}catch(e){res.status(500).json({error:'매장 예약 목록 조회 오류'})}});

router.put('/:id/status',authenticate,async(req,res)=>{try{const{id}=req.params,{status}=req.body;if(!['pending','confirmed','completed','cancelled'].includes(status))return res.status(400).json({error:'올바른 상태가 아닙니다.'});const rr=await db.query('SELECT * FROM reservations WHERE id=$1',[id]);if(!rr.rows.length)return res.status(404).json({error:'예약을 찾을 수 없습니다.'});const reservation=rr.rows[0];
    if(req.user.role==='user'){if(reservation.user_id!==req.user.id)return res.status(403).json({error:'예약 수정 권한이 없습니다.'});if(status!=='cancelled')return res.status(403).json({error:'고객은 예약을 취소만 할 수 있습니다.'});}
    if(req.user.role==='shop'){const s=await db.query('SELECT user_id FROM shops WHERE id=$1',[reservation.shop_id]);if(!s.rows.length||s.rows[0].user_id!==req.user.id)return res.status(403).json({error:'예약 수정 권한이 없습니다.'});if(status==='pending')return res.status(400).json({error:'이미 접수된 예약을 대기로 되돌릴 수 없습니다.'});}
    const r=await db.query(`UPDATE reservations SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *`,[status,id]);
    if(status==='confirmed'||status==='completed'||status==='cancelled'){
      const title=status==='cancelled'?'예약 취소':'예약 상태 변경';
      const message=status==='cancelled'?'예약이 취소되었습니다.':`예약 상태가 '${status}'로 변경되었습니다.`;
      if(req.user.role==='shop'||req.user.role==='admin')await db.query(`INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)`,[reservation.user_id,'reservation_status',title,message,`/my-activity.html?tab=reservations`]);
      if(req.user.role==='user'){const shop=await db.query('SELECT user_id,shop_name FROM shops WHERE id=$1',[reservation.shop_id]);if(shop.rows.length)await db.query(`INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)`,[shop.rows[0].user_id,'reservation_cancelled','고객 예약 취소',`고객이 ${shop.rows[0].shop_name} 예약을 취소했습니다.`,`/partner.html`]);}
    }
    res.json({reservation:r.rows[0]});
  }catch(e){console.error(e);res.status(500).json({error:'예약 상태 업데이트 오류'})}});

router.delete('/:id',authenticate,async(req,res)=>{try{const rr=await db.query('SELECT r.*,s.user_id shop_user_id,s.shop_name FROM reservations r JOIN shops s ON s.id=r.shop_id WHERE r.id=$1',[req.params.id]);if(!rr.rows.length)return res.status(404).json({error:'예약을 찾을 수 없습니다.'});const reservation=rr.rows[0];if(reservation.user_id!==req.user.id&&req.user.role!=='admin')return res.status(403).json({error:'예약 취소 권한이 없습니다.'});await db.query(`UPDATE reservations SET status='cancelled',updated_at=NOW() WHERE id=$1`,[req.params.id]);if(req.user.role==='user')await db.query(`INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)`,[reservation.shop_user_id,'reservation_cancelled','고객 예약 취소',`고객이 ${reservation.shop_name} 예약을 취소했습니다.`,`/partner.html`]);res.json({message:'예약이 취소되었습니다.'})}catch(e){console.error(e);res.status(500).json({error:'예약 취소 오류'})}});
module.exports=router;
