const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../services/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { latitude, longitude, radius = 10, sort = 'distance' } = req.query;
        let query = `SELECT s.*, u.name as owner_name, COUNT(r.id) as review_count, COALESCE(AVG(r.rating),0) as avg_rating FROM shops s JOIN users u ON u.id=s.user_id LEFT JOIN reviews r ON r.shop_id=s.id WHERE s.is_approved=TRUE AND s.is_active=TRUE`;
        const params=[];
        if(latitude && longitude){ query += `, (6371*acos(cos(radians($1))*cos(radians(s.latitude))*cos(radians(s.longitude)-radians($2))+sin(radians($1))*sin(radians(s.latitude)))) as distance`; params.push(latitude,longitude); }
        query += ` GROUP BY s.id,u.name`;
        if(latitude&&longitude){query += ` HAVING 6371*acos(cos(radians($1))*cos(radians(s.latitude))*cos(radians(s.longitude)-radians($2))+sin(radians($1))*sin(radians(s.latitude))) <= $3`;params.push(latitude,longitude,radius);}
        if(sort==='distance'&&latitude&&longitude) query+=' ORDER BY distance ASC'; else if(sort==='rating') query+=' ORDER BY avg_rating DESC'; else query+=' ORDER BY s.created_at DESC';
        res.json({shops:(await db.query(query,params)).rows});
    } catch(error){console.error('매장 목록 조회 오류:',error);res.status(500).json({error:'매장 목록 조회 중 오류가 발생했습니다.'});}
});

router.get('/:id', async (req,res)=>{
 try{
  const {id}=req.params;
  const result=await db.query(`SELECT s.*,u.name as owner_name,u.email as owner_email,COUNT(DISTINCT r.id) as review_count,COALESCE(AVG(r.rating),0) as avg_rating,COUNT(DISTINCT res.id) as reservation_count FROM shops s JOIN users u ON u.id=s.user_id LEFT JOIN reviews r ON r.shop_id=s.id LEFT JOIN reservations res ON res.shop_id=s.id WHERE s.id=$1 AND s.is_approved=TRUE GROUP BY s.id,u.name,u.email`,[id]);
  if(!result.rows.length)return res.status(404).json({error:'매장을 찾을 수 없습니다.'});
  const reviews=await db.query(`SELECT r.*,u.name as user_name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.shop_id=$1 ORDER BY r.created_at DESC LIMIT 10`,[id]);
  res.json({shop:result.rows[0],reviews:reviews.rows});
 }catch(error){console.error('매장 상세 조회 오류:',error);res.status(500).json({error:'매장 상세 조회 중 오류가 발생했습니다.'});}
});

router.post('/',authenticate,authorize('shop'),async(req,res)=>{
 try{
  const {shop_name,business_number,address,detail_address,latitude,longitude,phone,description,business_hours,services,short_description}=req.body;
  if((await db.query('SELECT id FROM shops WHERE user_id=$1',[req.user.id])).rows.length)return res.status(409).json({error:'이미 등록된 매장이 있습니다.'});
  const result=await db.query(`INSERT INTO shops(user_id,shop_name,business_number,address,detail_address,latitude,longitude,phone,description,business_hours,services,short_description) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[req.user.id,shop_name,business_number,address,detail_address,latitude,longitude,phone,description,business_hours,Array.isArray(services)?services:[],short_description]);
  res.status(201).json({message:'매장이 등록되었습니다. 관리자 승인을 기다려주세요.',shop:result.rows[0]});
 }catch(error){console.error('매장 등록 오류:',error);res.status(500).json({error:'매장 등록 중 오류가 발생했습니다.'});}
});

router.put('/:id',authenticate,authorize('shop','admin'),async(req,res)=>{
 try{
  const {id}=req.params; const {shop_name,address,detail_address,latitude,longitude,phone,description,business_hours,services,short_description}=req.body;
  if(req.user.role==='shop'){const s=await db.query('SELECT user_id FROM shops WHERE id=$1',[id]);if(!s.rows.length||s.rows[0].user_id!==req.user.id)return res.status(403).json({error:'매장 수정 권한이 없습니다.'});}
  const result=await db.query(`UPDATE shops SET shop_name=COALESCE($1,shop_name),address=COALESCE($2,address),detail_address=COALESCE($3,detail_address),latitude=COALESCE($4,latitude),longitude=COALESCE($5,longitude),phone=COALESCE($6,phone),description=COALESCE($7,description),business_hours=COALESCE($8,business_hours),services=COALESCE($9,services),short_description=COALESCE($10,short_description),updated_at=NOW() WHERE id=$11 RETURNING *`,[shop_name,address,detail_address,latitude,longitude,phone,description,business_hours,Array.isArray(services)?services:null,short_description,id]);
  if(!result.rows.length)return res.status(404).json({error:'매장을 찾을 수 없습니다.'});res.json({shop:result.rows[0]});
 }catch(error){console.error('매장 정보 업데이트 오류:',error);res.status(500).json({error:'매장 정보 업데이트 중 오류가 발생했습니다.'});}
});

router.post('/:id/photos',authenticate,authorize('shop','admin'),async(req,res)=>{
 try{
  const {id}=req.params; const {imageData}=req.body;
  if(!imageData||typeof imageData!=='string'||!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(imageData))return res.status(400).json({error:'JPG, PNG, WEBP 이미지 데이터가 필요합니다.'});
  const owner=await db.query('SELECT user_id,shop_images FROM shops WHERE id=$1',[id]);if(!owner.rows.length)return res.status(404).json({error:'매장을 찾을 수 없습니다.'});
  if(req.user.role==='shop'&&owner.rows[0].user_id!==req.user.id)return res.status(403).json({error:'사진 업로드 권한이 없습니다.'});
  const match=imageData.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);const ext=match[1].toLowerCase().replace('jpeg','jpg');const buffer=Buffer.from(match[2],'base64');
  if(buffer.length>8*1024*1024)return res.status(413).json({error:'사진은 8MB 이하만 업로드할 수 있습니다.'});
  const dir=path.join(__dirname,'..','public','uploads','shops');fs.mkdirSync(dir,{recursive:true});const name=`${id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;fs.writeFileSync(path.join(dir,name),buffer);const url=`/uploads/shops/${name}`;
  const images=Array.isArray(owner.rows[0].shop_images)?owner.rows[0].shop_images:[];images.push(url);const result=await db.query('UPDATE shops SET shop_images=$1,updated_at=NOW() WHERE id=$2 RETURNING shop_images',[images,id]);res.status(201).json({url,shop_images:result.rows[0].shop_images});
 }catch(error){console.error('매장 사진 업로드 오류:',error);res.status(500).json({error:'사진 업로드 중 오류가 발생했습니다.'});}
});

router.delete('/:id/photos',authenticate,authorize('shop','admin'),async(req,res)=>{
 try{const {id}=req.params;const {url}=req.body;const s=await db.query('SELECT user_id,shop_images FROM shops WHERE id=$1',[id]);if(!s.rows.length)return res.status(404).json({error:'매장을 찾을 수 없습니다.'});if(req.user.role==='shop'&&s.rows[0].user_id!==req.user.id)return res.status(403).json({error:'사진 삭제 권한이 없습니다.'});const images=(s.rows[0].shop_images||[]).filter(x=>x!==url);await db.query('UPDATE shops SET shop_images=$1,updated_at=NOW() WHERE id=$2',[images,id]);if(url&&url.startsWith('/uploads/')){const file=path.join(__dirname,'..','public',url.replace(/^\//,''));if(fs.existsSync(file))fs.unlinkSync(file);}res.json({shop_images:images});}catch(error){res.status(500).json({error:'사진 삭제 중 오류가 발생했습니다.'});}
});

router.post('/:id/reviews',authenticate,async(req,res)=>{
 try{const {id}=req.params;const {rating,content,reservation_id}=req.body;if(!rating||rating<1||rating>5)return res.status(400).json({error:'평점은 1~5 사이여야 합니다.'});const result=await db.query('INSERT INTO reviews(user_id,shop_id,reservation_id,rating,content) VALUES($1,$2,$3,$4,$5) RETURNING *',[req.user.id,id,reservation_id,rating,content]);await db.query('UPDATE shops SET rating=(SELECT AVG(rating) FROM reviews WHERE shop_id=$1),review_count=(SELECT COUNT(*) FROM reviews WHERE shop_id=$1),updated_at=NOW() WHERE id=$1',[id]);res.status(201).json({review:result.rows[0]});}catch(error){console.error('리뷰 작성 오류:',error);res.status(500).json({error:'리뷰 작성 중 오류가 발생했습니다.'});}
});

router.get('/:id/dashboard',authenticate,authorize('shop','admin'),async(req,res)=>{
 try{const {id}=req.params;if(req.user.role==='shop'){const s=await db.query('SELECT user_id FROM shops WHERE id=$1',[id]);if(!s.rows.length||s.rows[0].user_id!==req.user.id)return res.status(403).json({error:'대시보드 접근 권한이 없습니다.'});}const today=new Date().toISOString().split('T')[0];const stats=await db.query(`SELECT (SELECT COUNT(*) FROM quotes q JOIN pcs p ON p.id=q.pc_id WHERE q.status='open') as new_quotes,(SELECT COUNT(*) FROM bids b JOIN quotes q ON q.id=b.quote_id WHERE b.shop_id=$1 AND q.status='bidding') as active_bids,(SELECT COUNT(*) FROM reservations WHERE shop_id=$1 AND reservation_date=$2 AND status!='cancelled') as today_reservations,(SELECT COUNT(*) FROM chat_rooms WHERE shop_id=$1) as chat_rooms`,[id,today]);const recentQuotes=await db.query(`SELECT q.*,p.title as pc_title,p.cpu,p.gpu,u.name as user_name FROM quotes q LEFT JOIN pcs p ON p.id=q.pc_id JOIN users u ON u.id=q.user_id WHERE q.status IN('open','bidding') ORDER BY q.created_at DESC LIMIT 10`);const recentBids=await db.query(`SELECT b.*,q.title as quote_title,u.name as user_name FROM bids b JOIN quotes q ON q.id=b.quote_id JOIN users u ON u.id=q.user_id WHERE b.shop_id=$1 ORDER BY b.created_at DESC LIMIT 10`,[id]);res.json({stats:stats.rows[0],recentQuotes:recentQuotes.rows,recentBids:recentBids.rows});}catch(error){console.error('대시보드 조회 오류:',error);res.status(500).json({error:'대시보드 조회 중 오류가 발생했습니다.'});}
});
module.exports=router;
