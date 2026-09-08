const express=require('express');
const db=require('../services/database');
const {authenticate,authorize}=require('../middleware/auth');
const router=express.Router();

// 홈 화면 문구처럼 관리자가 직접 고치는 값을 저장합니다.
const KEYS=['home_lead_title','home_lead_sub'];
let ready=false;
async function ensureTable(){
  if(ready)return;
  await db.query('CREATE TABLE IF NOT EXISTS site_settings(key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMP DEFAULT NOW())');
  ready=true;
}

router.get('/',async(req,res)=>{
  try{
    await ensureTable();
    const r=await db.query('SELECT key,value FROM site_settings');
    const out={};
    r.rows.forEach(x=>{out[x.key]=x.value});
    res.json({settings:out});
  }catch(e){console.error('site settings load',e);res.status(500).json({error:'설정을 불러오지 못했습니다.'})}
});

router.put('/',authenticate,authorize('admin'),async(req,res)=>{
  try{
    await ensureTable();
    const body=req.body||{};
    const entries=KEYS.filter(k=>typeof body[k]==='string');
    if(!entries.length)return res.status(400).json({error:'저장할 값이 없습니다.'});
    for(const k of entries){
      const v=String(body[k]).slice(0,600);
      await db.query('INSERT INTO site_settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=$2,updated_at=NOW()',[k,v]);
    }
    const r=await db.query('SELECT key,value FROM site_settings');
    const out={};
    r.rows.forEach(x=>{out[x.key]=x.value});
    res.json({settings:out,message:'저장했습니다.'});
  }catch(e){console.error('site settings save',e);res.status(500).json({error:'설정 저장에 실패했습니다.'})}
});

module.exports=router;
