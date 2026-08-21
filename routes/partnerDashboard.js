const express=require('express');
const db=require('../services/database');
const {authenticate,authorize}=require('../middleware/auth');
const router=express.Router();

router.get('/:shopId/dashboard',authenticate,authorize('shop','admin'),async(req,res)=>{
  try{
    const {shopId}=req.params;
    if(req.user.role==='shop'){
      const own=await db.query('SELECT id FROM shops WHERE id=$1 AND user_id=$2',[shopId,req.user.id]);
      if(!own.rows.length)return res.status(403).json({error:'이 업체의 관리자만 조회할 수 있습니다.'});
    }
    const [shopQ,newQuotesQ,activeBidsQ,todayQ,chatQ,recentQuotesQ,recentBidsQ]=await Promise.all([
      db.query('SELECT id,shop_name,is_approved FROM shops WHERE id=$1',[shopId]),
      db.query(`SELECT COUNT(*)::int count FROM quotes WHERE status IN ('open','bidding')`),
      db.query(`SELECT COUNT(*)::int count FROM bids WHERE shop_id=$1 AND created_at >= NOW()-INTERVAL '30 days'`,[shopId]),
      db.query(`SELECT COUNT(*)::int count FROM reservations WHERE shop_id=$1 AND reservation_date=CURRENT_DATE AND status!='cancelled'`,[shopId]),
      db.query('SELECT COUNT(*)::int count FROM chat_rooms WHERE shop_id=$1',[shopId]),
      db.query(`SELECT q.id,q.title,q.quote_type,q.created_at,u.name user_name,p.title pc_title,p.cpu,p.gpu FROM quotes q JOIN users u ON u.id=q.user_id LEFT JOIN pcs p ON p.id=q.pc_id WHERE q.status IN ('open','bidding') ORDER BY q.created_at DESC LIMIT 8`),
      db.query(`SELECT b.id,b.amount,b.created_at,q.title quote_title,u.name user_name FROM bids b JOIN quotes q ON q.id=b.quote_id JOIN users u ON u.id=q.user_id WHERE b.shop_id=$1 ORDER BY b.created_at DESC LIMIT 8`,[shopId])
    ]);
    if(!shopQ.rows.length)return res.status(404).json({error:'업체를 찾을 수 없습니다.'});
    res.json({stats:{new_quotes:newQuotesQ.rows[0].count,active_bids:activeBidsQ.rows[0].count,today_reservations:todayQ.rows[0].count,chat_rooms:chatQ.rows[0].count},recentQuotes:recentQuotesQ.rows,recentBids:recentBidsQ.rows});
  }catch(error){console.error('업체 대시보드 오류:',error);res.status(500).json({error:'업체 대시보드를 불러오지 못했습니다.'});}
});
module.exports=router;
