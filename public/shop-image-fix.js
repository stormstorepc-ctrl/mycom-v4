(()=>{
  const fix=()=>{
    const list=document.getElementById('mycomShopList');
    if(!list)return;
    list.querySelectorAll('article').forEach(card=>{
      const img=card.querySelector('img[data-shop-image]');
      const button=card.querySelector('button[onclick*="/shop.html?id="]');
      if(!img||!button||img.dataset.proxyApplied==='1')return;
      const m=(button.getAttribute('onclick')||'').match(/[?&]id=([^'&]+)/);
      if(!m)return;
      const id=decodeURIComponent(m[1]);
      img.dataset.proxyApplied='1';
      img.src='/api/shop-image/'+encodeURIComponent(id)+'?v='+Date.now();
    });
  };
  document.addEventListener('DOMContentLoaded',()=>{fix();setTimeout(fix,500);setTimeout(fix,1500);setTimeout(fix,3000)});
  new MutationObserver(fix).observe(document.documentElement,{childList:true,subtree:true});
})();
