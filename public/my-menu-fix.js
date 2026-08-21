(() => {
  const menus = [...document.querySelectorAll('.menu-item')];
  const find = (text) => menus.find(el => (el.textContent || '').includes(text));
  const shopMenu = find('내 매장 관리');
  const adminMenu = find('관리자 설정');
  if (!shopMenu && !adminMenu) return;
  const toast = (msg) => { if (typeof window.showToast === 'function') window.showToast(msg); else alert(msg); };
  const getToken = () => localStorage.getItem('mycom_token') || localStorage.getItem('token');
  const go = (url) => { window.location.href = url; };
  const bind = (user) => {
    const role = user?.role;
    if (shopMenu) {
      if (role === 'shop' && user?.shop_id) shopMenu.onclick = e => { e.preventDefault(); go('/partner.html'); };
      else if (role === 'admin') shopMenu.onclick = e => { e.preventDefault(); go('/admin.html'); };
      else shopMenu.onclick = e => { e.preventDefault(); toast('컴퓨터 업체 계정으로 로그인하면 매장 관리가 가능합니다.'); };
    }
    if (adminMenu) {
      if (role === 'admin') adminMenu.onclick = e => { e.preventDefault(); go('/admin.html'); };
      else if (role === 'shop') adminMenu.onclick = e => { e.preventDefault(); go('/partner.html'); };
      else adminMenu.onclick = e => { e.preventDefault(); toast('최고 관리자 계정만 이용할 수 있습니다.'); };
    }
  };
  const check = async () => {
    const token = getToken();
    if (!token) return bind(null);
    try {
      const r = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) throw new Error('인증 실패');
      const { user } = await r.json();
      bind(user);
    } catch (e) { bind(null); }
  };
  check(); setTimeout(check, 300); setTimeout(check, 1000);
})();
