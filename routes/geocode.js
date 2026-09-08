const express=require('express');
const router=express.Router();

// 구글 지도 키를 클라이언트에 박아두지 않고 서버에서만 사용합니다.
// .env 에 GOOGLE_MAPS_KEY(서버 지오코딩용)와
// GOOGLE_MAPS_BROWSER_KEY(리퍼러 제한을 걸어둔 지도 표시용)를 넣어주세요.
const SERVER_KEY=process.env.GOOGLE_MAPS_KEY||'';
const BROWSER_KEY=process.env.GOOGLE_MAPS_BROWSER_KEY||SERVER_KEY;

// 지도 표시용 키 — 반드시 Google Cloud Console에서 HTTP 리퍼러로 제한해두세요.
router.get('/maps-key',(req,res)=>{
  res.set('Cache-Control','public,max-age=300');
  res.json({key:BROWSER_KEY});
});

// 주소 → 좌표. 키는 서버에만 남습니다.
router.get('/',async(req,res)=>{
  const address=String(req.query.address||'').trim();
  if(!address)return res.status(400).json({error:'주소를 입력해주세요.'});
  if(!SERVER_KEY)return res.status(503).json({error:'지도 키가 설정되지 않았습니다.'});
  try{
    const url='https://maps.googleapis.com/maps/api/geocode/json?language=ko&region=KR&key='+encodeURIComponent(SERVER_KEY)+'&address='+encodeURIComponent(address);
    const r=await fetch(url);
    const d=await r.json();
    if(d.status!=='OK'||!d.results||!d.results[0])return res.status(404).json({error:'주소의 좌표를 찾지 못했습니다.',status:d.status});
    const loc=d.results[0].geometry.location;
    res.json({lat:loc.lat,lng:loc.lng,formatted_address:d.results[0].formatted_address});
  }catch(e){
    console.error('geocode',e);
    res.status(500).json({error:'좌표를 찾는 중 오류가 발생했습니다.'});
  }
});

module.exports=router;
