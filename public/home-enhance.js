(() => {
  const go = (type) => { location.href = `/ai.html?type=${encodeURIComponent(type)}`; };
  const textMap = [
    ['조립대행','assembly'], ['PC 조립','assembly'], ['컴퓨터 견적','quote'], ['PC 견적','quote'],
    ['방문예약','visit'], ['출장 서비스','visit'], ['내컴퓨터팔기','sell'], ['내 컴퓨터 팔기','sell'],
    ['PC 판매','sell'], ['수리','repair'], ['업그레이드','repair']
  ];
  const bind = () => {
    document.querySelectorAll('a,button,.category,.service-card,.hero-btn').forEach(el => {
      const t = (el.textContent || '').replace(/\s+/g,' ').trim();
      const hit = textMap.find(([label]) => t.includes(label));
      if (!hit || el.dataset.mycomBound) return;
      el.dataset.mycomBound = '1';
      el.addEventListener('click', (e) => {
        if (el.tagName === 'A') e.preventDefault();
        go(hit[1]);
      });
    });
    if (!document.getElementById('mycomQuickMenu')) {
      const anchor = document.querySelector('.search-box, .hero-slider, .section');
      if (!anchor || !anchor.parentNode) return;
      const box = document.createElement('section'); box.id='mycomQuickMenu'; box.style.cssText='margin:0 18px 24px';
      box.innerHTML = `<div style="font-size:20px;font-weight:900;margin:0 0 14px;letter-spacing:-1px">무엇을 도와드릴까요?</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"><button data-t="assembly">🔧<span>조립대행</span></button><button data-t="quote">💻<span>컴퓨터 견적</span></button><button data-t="visit">🏠<span>방문예약</span></button><button data-t="sell">💰<span>내 PC 팔기</span></button></div>`;
      box.querySelectorAll('button').forEach(b=>{b.style.cssText='background:#fff;border:0;border-radius:16px;padding:13px 5px;box-shadow:0 5px 15px rgba(0,0,0,.05);font-size:22px;font-weight:800;display:flex;flex-direction:column;gap:6px;align-items:center';b.querySelector('span').style.cssText='font-size:11px';b.onclick=()=>go(b.dataset.t);});
      anchor.parentNode.insertBefore(box, anchor.nextSibling);
    }
  };
  document.addEventListener('DOMContentLoaded', bind); setTimeout(bind,500); setTimeout(bind,1500);
})();
