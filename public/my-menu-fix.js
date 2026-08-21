(() => {
  const token = localStorage.getItem('mycom_token') || localStorage.getItem('token');
  const menus = [...document.querySelectorAll('.menu-item')];
  const find = (text) => menus.find(el => (el.textContent || '').includes(text));
  const shopMenu = find('내 매장 관리');
  const adminMenu = find('관리자 설정');
  if (!shopMenu && !adminMenu) return;

  const toast = (msg) => {
    if (typeof window.showToast === 'function') window.showToast(msg);
    else alert(msg);
  };
  const go = (url) => { window.location.href = url; };

  if (!token) {
    if (shopMenu) shopMenu.onclick = () => toast('로그인 후 이용할 수 있습니다.');
    if (adminMenu) adminMenu.onclick = () => toast('관리자 계정으로 로그인해야 합니다.');
    return;
  }

  fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('인증 실패')))
    .then(({ user }) => {
      const role = user?.role;
      if (shopMenu) {
        if (role === 'shop') {
          shopMenu.onclick = () => go('/shop-profile.html');
        } else if (role === 'admin') {
          shopMenu.onclick = () => go('/admin.html');
        } else {
          shopMenu.onclick = () => toast('컴퓨터 업체 계정으로 로그인하면 매장 관리가 가능합니다.');
        }
      }
      if (adminMenu) {
        if (role === 'admin') {
          adminMenu.onclick = () => go('/admin.html');
        } else if (role === 'shop') {
          adminMenu.onclick = () => go('/partner.html');
        } else {
          adminMenu.onclick = () => toast('최고 관리자 계정만 이용할 수 있습니다.');
        }
      }
    })
    .catch(() => {
      if (shopMenu) shopMenu.onclick = () => toast('로그인 정보를 확인해주세요.');
      if (adminMenu) adminMenu.onclick = () => toast('로그인 정보를 확인해주세요.');
    });
})();
