const express=require('express');
const router=express.Router();

/*
  월드메모리(worldmemory.co.kr) 매입 단가표를 읽어 중고 시세를 추정합니다.
  - 단가표는 '업체 매입가'입니다. 개인이 매장에 팔 때 받을 수 있는 금액의 기준선으로 씁니다.
  - 페이지 구조가 바뀌면 매칭이 실패할 수 있으므로, 실패한 항목은 응답의 unmatched로 알려줍니다.
*/

const BASE='https://www.worldmemory.co.kr';
const LIST=BASE+'/price/computer.do';

// 부품별 최상위 분류 번호
const ROOT={
  cpu:8, gpu:14, board:12, ram:1, ssd:4273, hdd:4277, power:4166, monitor:20, laptop:4169
};

const PART_LABEL={cpu:'CPU',gpu:'그래픽카드',board:'메인보드',ram:'메모리',ssd:'SSD',hdd:'HDD',power:'파워',monitor:'모니터',laptop:'노트북'};

// 부품 판매 화면의 카테고리 이름 → 부품 키
const CATEGORY_KEY={'CPU':'cpu','그래픽카드':'gpu','메인보드':'board','메모리':'ram','SSD':'ssd','HDD':'hdd','파워':'power','모니터':'monitor','노트북':'laptop'};

const CONDITION={excellent:1.1,good:1,fair:0.85,poor:0.65};

const cache=new Map();
const TTL=12*60*60*1000;
const LEAF_LIMIT=6;      // 한 부품당 최대로 열어보는 하위 페이지 수
const TIME_BUDGET=10000; // 한 요청에 쓸 수 있는 전체 시간(ms)

async function fetchPage(url){
  const hit=cache.get(url);
  if(hit&&Date.now()-hit.at<TTL)return hit.html;
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),8000);
  try{
    const r=await fetch(url,{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; MYCOM price bot)','Accept-Language':'ko'}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const html=await r.text();
    cache.set(url,{at:Date.now(),html});
    return html;
  }finally{clearTimeout(timer)}
}

const strip=s=>String(s).replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();

// 단가표의 행을 { name, price }로 뽑아냅니다.
function parseRows(html){
  const out=[];
  const trs=html.match(/<tr[\s\S]*?<\/tr>/gi)||[];
  for(const tr of trs){
    const cells=(tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi)||[]).map(strip);
    if(cells.length<2)continue;
    const last=cells[cells.length-1];
    const m=last.match(/([\d,]+)\s*원/);
    if(!m)continue;
    const price=parseInt(m[1].replace(/,/g,''),10);
    if(!price)continue;
    const name=cells.slice(0,-1).sort((a,b)=>b.length-a.length)[0]||'';
    if(!name)continue;
    out.push({name,price});
  }
  return out;
}

// 하위 분류 링크(세대·제조사별 페이지)를 모읍니다.
function harvestLeaves(html,root){
  const found=new Set();
  const re=/computer\.do\?([a-zA-Z0-9_=&;]+)/g;
  let m;
  while((m=re.exec(html))){
    const q=m[1].replace(/&amp;/g,'&');
    if(!new RegExp('ctgry_no1='+root+'(&|$)').test(q))continue;
    if(!/ctgry_no2=\d+/.test(q))continue;
    found.add(LIST+'?'+q);
  }
  return [...found].slice(0,LEAF_LIMIT);
}

const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');

// 모델명에서 비교에 쓸 토큰을 뽑습니다.
function tokens(q){
  return String(q||'').toUpperCase().match(/[A-Z0-9]{2,}/g)||[];
}
// 숫자를 포함한 핵심 토큰(5800X, 4070, 9700K 등)
function coreTokens(q){
  return tokens(q).filter(t=>/\d/.test(t)&&t.length>=3
    &&!/^(DDR\d?|GB|TB|MHZ|\d{1,2})$/.test(t)
    &&!/^\d+(GB|TB|MB|W|MHZ|HZ|RPM|PIN)$/.test(t));
}

function bestMatch(rows,query){
  const cores=coreTokens(query);
  if(!cores.length)return null;
  const toks=tokens(query);
  let best=null;
  for(const row of rows){
    const n=norm(row.name);
    if(!cores.every(c=>n.includes(norm(c))))continue;
    const hit=toks.filter(t=>n.includes(norm(t))).length;
    const score=hit/toks.length - Math.min(0.3,(n.length-norm(query).length)/300);
    if(!best||score>best.score)best={...row,score};
  }
  return best&&best.score>=0.4?best:null;
}

// 한 부품의 시세를 찾습니다.
async function lookup(key,query,deadline){
  const root=ROOT[key];
  if(!root||!coreTokens(query).length)return null;
  if(Date.now()>deadline)return null;
  const top=await fetchPage(LIST+'?ctgry_no1='+root).catch(()=>null);
  if(!top)return null;

  let found=bestMatch(parseRows(top),query);
  if(found)return found;

  for(const url of harvestLeaves(top,root)){
    if(Date.now()>deadline)break;
    const html=await fetchPage(url).catch(()=>null);
    if(!html)continue;
    found=bestMatch(parseRows(html),query);
    if(found)return found;
  }
  return null;
}

const round=n=>Math.max(0,Math.round(n/1000)*1000);

function priceRange(base){
  // 매입 단가가 하한, 개인 거래 여유를 더해 상한을 잡습니다.
  return {min:round(base*0.95),max:round(base*1.3)};
}

// 완본체 추정: 입력된 부품별로 단가를 찾아 합산합니다.
router.get('/estimate',async(req,res)=>{
  const q=req.query||{};
  const factor=CONDITION[String(q.condition||'good')]||1;
  const wanted=[['cpu',q.cpu],['gpu',q.gpu],['board',q.board],['ram',q.ram],['ssd',q.storage||q.ssd],['power',q.power]]
    .filter(([,v])=>String(v||'').trim());
  if(!wanted.length)return res.status(400).json({error:'사양을 한 가지 이상 입력해주세요.'});

  const deadline=Date.now()+TIME_BUDGET;
  const items=[],unmatched=[];
  const results=await Promise.all(wanted.map(async([key,value])=>{
    try{ return [key,value,await lookup(key,value,deadline)] }
    catch(e){ return [key,value,null] }
  }));
  for(const [key,value,hit] of results){
    if(hit)items.push({part:PART_LABEL[key],query:String(value).trim(),matched:hit.name,price:hit.price});
    else unmatched.push(PART_LABEL[key]);
  }

  if(!items.length){
    return res.status(404).json({error:'단가표에서 일치하는 부품을 찾지 못했습니다. 모델명을 더 정확히 입력해주세요.',unmatched});
  }

  const sum=items.reduce((a,b)=>a+b.price,0);
  const base=sum*factor;
  res.json({
    source:'월드메모리 매입 단가표',
    source_url:LIST,
    condition:String(q.condition||'good'),
    items,unmatched,
    parts_total:round(sum),
    range:priceRange(base),
    checked_at:new Date().toISOString()
  });
});

// 부품 한 개 추정
router.get('/part',async(req,res)=>{
  const category=String(req.query.category||'').trim();
  const model=String(req.query.model||'').trim();
  const key=CATEGORY_KEY[category];
  if(!key)return res.status(400).json({error:'단가표에 없는 부품 분류입니다.'});
  if(!model)return res.status(400).json({error:'모델명을 입력해주세요.'});
  const factor=CONDITION[String(req.query.condition||'good')]||1;
  try{
    const hit=await lookup(key,model,Date.now()+TIME_BUDGET);
    if(!hit)return res.status(404).json({error:'단가표에서 이 모델을 찾지 못했습니다. 모델명을 더 정확히 입력해주세요.'});
    res.json({
      source:'월드메모리 매입 단가표',
      source_url:LIST,
      items:[{part:PART_LABEL[key],query:model,matched:hit.name,price:hit.price}],
      parts_total:round(hit.price),
      range:priceRange(hit.price*factor),
      checked_at:new Date().toISOString()
    });
  }catch(e){
    console.error('market price part',e);
    res.status(502).json({error:'시세 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'});
  }
});

module.exports=router;
