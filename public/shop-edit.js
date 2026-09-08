let token=localStorage.getItem('mycom_token')||localStorage.getItem('token'),shop;
let pendingLat=null,pendingLng=null;

async function api(url,opt={}){const h={...(opt.headers||{})};if(token)h.Authorization='Bearer '+token;const r=await fetch(url,{...opt,headers:h,cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||`요청 실패 (${r.status})`);return d}

async function refreshShop(){const d=await api('/api/shops/my?t='+Date.now());if(!d.shop)throw Error('매장 정보를 찾을 수 없습니다.');shop=d.shop;renderPhotos();return shop}

async function boot(){
  try{
    const m=await api('/api/auth/me?t='+Date.now());
    if(m.user?.role!=='shop'||!m.user.shop_id){location.href='/partner.html';return}
    await refreshShop();
    for(const k of ['shop_name','phone','address','detail_address','description','business_hours','closed_days','short_description']){const el=document.getElementById(k);if(el)el.value=shop[k]||''}
    const kakao=document.getElementById('open_kakao_url');if(kakao)kakao.value=shop.open_kakao_url||'';
    const services=document.getElementById('services');if(services)services.value=(shop.services||[]).join(', ');
    renderPhotos();renderGpsStatus();
  }catch(e){alert(e.message);location.href='/partner.html'}
}

function gpsMsg(html,color){const el=document.getElementById('gpsStatus');if(!el)return;el.innerHTML=html;el.style.color=color}

function renderGpsStatus(){
  if(pendingLat!=null){
    gpsMsg('<i class="ph-fill ph-map-pin"></i> 새 좌표 ('+pendingLat.toFixed(5)+', '+pendingLng.toFixed(5)+') — <b>정보 저장</b>을 눌러야 반영됩니다.','#1F6FE5');
    return;
  }
  if(shop&&shop.latitude!=null&&shop.longitude!=null){
    gpsMsg('<i class="ph-fill ph-check-circle"></i> 좌표 설정됨 ('+Number(shop.latitude).toFixed(5)+', '+Number(shop.longitude).toFixed(5)+') · 내 주변 검색에 노출됩니다.','#087657');
  }else{
    gpsMsg('<i class="ph-fill ph-warning-circle"></i> 좌표가 없습니다. 주소를 검색하면 좌표가 자동으로 등록되고 "내 주변" 검색에 노출됩니다.','#C05621');
  }
}

/* 주소 검색 → 도로명 주소 입력 → 좌표 자동 조회 */
function searchAddress(){
  if(!window.daum||!daum.Postcode){alert('주소 검색을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');return}
  new daum.Postcode({oncomplete:function(data){
    const addr=data.roadAddress||data.jibunAddress;
    document.getElementById('address').value=addr;
    document.getElementById('detail_address')?.focus();
    geocode(addr);
  }}).open();
}

async function geocode(addr){
  gpsMsg('<i class="ph ph-spinner"></i> 주소의 좌표를 찾는 중…','#6B7684');
  let lat=null,lng=null;
  try{
    const r=await fetch('/api/geocode?address='+encodeURIComponent(addr));
    const d=await r.json();
    if(r.ok&&typeof d.lat==='number'){lat=d.lat;lng=d.lng}
  }catch(e){}
  if(lat==null){
    try{
      const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q='+encodeURIComponent(addr),{headers:{'Accept-Language':'ko'}});
      const d=await r.json();
      if(Array.isArray(d)&&d.length){lat=parseFloat(d[0].lat);lng=parseFloat(d[0].lon)}
    }catch(e){}
  }
  if(lat==null){gpsMsg('<i class="ph-fill ph-warning-circle"></i> 주소로 좌표를 찾지 못했습니다. 매장에서 <b>현재 위치로 설정</b>을 눌러주세요.','#C05621');return}
  pendingLat=lat;pendingLng=lng;renderGpsStatus();
}

async function setLocation(){
  if(!('geolocation' in navigator))return alert('이 브라우저에서는 위치 확인을 지원하지 않습니다.');
  const btn=event?.target;if(btn)btn.disabled=true;
  navigator.geolocation.getCurrentPosition(async pos=>{
    try{
      const d=await api('/api/shops/'+shop.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({latitude:pos.coords.latitude,longitude:pos.coords.longitude})});
      shop=d.shop||shop;pendingLat=null;pendingLng=null;renderGpsStatus();alert('현재 위치로 매장 좌표가 설정되었습니다.');
    }catch(e){alert(e.message)}finally{if(btn)btn.disabled=false}
  },()=>{
    alert('위치 권한이 거부되었거나 위치를 확인할 수 없습니다. 브라우저 설정에서 위치 권한을 허용해주세요.');
    if(btn)btn.disabled=false;
  },{enableHighAccuracy:true,timeout:8000});
}

function renderPhotos(){const box=document.getElementById('photos');const arr=Array.isArray(shop?.shop_images)?shop.shop_images.filter(Boolean):[];box.innerHTML=arr.length?arr.map((url,i)=>{const safe=JSON.stringify(String(url)).replace(/</g,'\\u003c');return `<div class="photo"><img src="${String(url).replace(/"/g,'&quot;')}" alt="매장사진 ${i+1}" loading="lazy"><button class="del" type="button" onclick='deletePhoto(${safe})'>삭제</button><button class="cover" type="button" onclick='setCover(${safe})'>${shop.cover_image===url?'★ 대표사진':'대표사진'}</button></div>`}).join(''):'<div class="hint">등록된 매장 사진이 없습니다.</div>'}

async function saveInfo(){
  const body={};
  for(const k of ['shop_name','phone','address','detail_address','description','business_hours','closed_days','short_description']){const el=document.getElementById(k);if(el)body[k]=el.value.trim()}
  const kakao=document.getElementById('open_kakao_url');
  if(kakao){body.open_kakao_url=kakao.value.trim();if(body.open_kakao_url&&!/^https:\/\/open\.kakao\.com\//i.test(body.open_kakao_url))return alert('오픈카톡 링크는 https://open.kakao.com/ 형식이어야 합니다.')}
  const services=document.getElementById('services');
  if(services)body.services=services.value.split(',').map(x=>x.trim()).filter(Boolean);
  if(pendingLat!=null&&pendingLng!=null){body.latitude=pendingLat;body.longitude=pendingLng}
  try{
    const d=await api('/api/shops/'+shop.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    shop=d.shop||shop;pendingLat=null;pendingLng=null;
    await refreshShop();renderGpsStatus();alert('매장 정보가 저장되었습니다.');
  }catch(e){alert(e.message)}
}

async function uploadPhotos(){const input=document.getElementById('photoInput'),files=[...input.files];if(!files.length)return alert('사진을 선택해주세요.');try{const current=Array.isArray(shop.shop_images)?shop.shop_images.length:0;if(current+files.length>10)return alert(`현재 ${current}장 등록되어 있습니다. 최대 10장까지 등록할 수 있습니다.`);for(const f of files){if(!/^image\/(jpeg|jpg|png|webp)$/i.test(f.type))throw Error(f.name+'은 JPG, PNG, WEBP 이미지만 가능합니다.');if(f.size>8*1024*1024)throw Error(f.name+'은 8MB를 초과합니다.');const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error(f.name+' 파일을 읽지 못했습니다.'));r.readAsDataURL(f)});await api('/api/shops/'+shop.id+'/photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageData:data})});}input.value='';await refreshShop();alert('매장 사진이 등록되었습니다.')}catch(e){alert(e.message)}}

async function deletePhoto(url){if(!confirm('이 사진을 삭제할까요?'))return;try{await api('/api/shops/'+shop.id+'/photos',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:String(url)})});await refreshShop();alert('사진이 삭제되었습니다.')}catch(e){alert(e.message)}}

async function setCover(url){try{const d=await api('/api/shops/'+shop.id+'/cover',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:String(url)})});shop.cover_image=d.cover_image||url;await refreshShop();alert('대표사진이 적용되었습니다.')}catch(e){alert(e.message)}}

boot();
