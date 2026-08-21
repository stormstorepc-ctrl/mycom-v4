(()=>{
  const menus=[...document.querySelectorAll('.menu-item')];
  const find=text=>menus.find(el=>(el.textContent||'').includes(text));
  const toast=msg=>{if(typeof window.showToast==='function')window.showToast(msg);else alert(msg)};
  const getToken=()=>localStorage.getItem('mycom_token')||localStorage.getItem('token');
  const go=url=>window.location.href=url;
  const bindClick=(el,fn)=>{if(!el)return;el.onclick=e=>{e.preventDefault();e.stopPropagation();fn()}};
  const addNotificationMenu=()=>{if(!menus.length||document.querySelector('[data-mycom-notifications]'))return;const first=menus[0],parent=first.parentElement;if(!parent)return;const item=first.cloneNode(false);item.removeAttribute('onclick');item.dataset.mycomNotifications='1';item.textContent='🔔 알림  ›';item.style.cursor='pointer';item.style.display='flex';item.style.justifyContent='space-between';item.style.alignItems='center';item.onclick=()=>go('/notifications.html');parent.appendChild(item)};
  const bind=user=>{const role=String(user?.role||'').toLowerCase();const shopMenu=find('내 매장 관리'),adminMenu=find('관리자 설정');const activityMenus=[['진행 중인 입찰','bids'],['내 견적','quotes'],['예약 내역','reservations'],['상담 내역','chats']];activityMenus.forEach(([label,tab])=>{const el=find(label);if(el)bindClick(el,()=>{if(!user)return toast('로그인 후 이용할 수 있습니다.');go('/my-activity.html?tab='+tab)})});if(shopMenu){if(role==='shop'&&user?.shop_id)bindClick(shopMenu,()=>go('/partner.html'));else if(role==='admin')bindClick(shopMenu,()=>toast('최고 관리자 계정에서는 내 매장 관리가 필요하지 않습니다.'));else bindClick(shopMenu,()=>toast('컴퓨터 업체 계정으로 로그인하면 매장 관리가 가능합니다.'))}if(adminMenu){if(role==='admin')bindClick(adminMenu,()=>go('/admin.html'));else bindClick(adminMenu,()=>toast('최고 관리자 계정만 이용할 수 있습니다.'))}addNotificationMenu()};
  const check=async()=>{const token=getToken();if(!token)return bind(null);try{const r=await fetch('/api/auth/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!r.ok)throw Error();const d=await r.json();bind(d.user)}catch(e){bind(null)}};
  check();setTimeout(check,300);setTimeout(check,1000);
})();
