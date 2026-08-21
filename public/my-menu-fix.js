(() => {
  const menus = [...document.querySelectorAll('.menu-item')];
  const find = (text) => menus.find(el => (el.textContent || '').includes(text));
  const shopMenu = find('내 매장 관리');
  const adminMenu = find('관리자 설정');
  if (!shopMenu && !adminMenu) return;

  const toast = (msg) => {
    if (typeof window.showToast === 'function') window.showToast(msg);
    else alert(msg);
  };
  const getToken = () => localStorage.getItem('mycom_token') || localStorage.getItem('token');
  const go = (url) => { window.location.href = url; };

  const bind = (user) => {
    const role = String(user?.role || '').toLowerCase();

    // '내 매장 관리'는 업체 계정 전용입니다.
    // 최고관리자도 관리자 설정과 혼동하지 않도록 별도 화면으로 보내지 않습니다.
    if (shopMenu) {
      if (role === 'shop' && user?.shop_id) {
        shopMenu.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          go('/partner.html');
        };
      } else if (role === 'admin') {
        shopMenu.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          toast('최고 관리자 계정에서는 내 매장 관리 기능을 사용할 수 없습니다.');
        };
      } else {
        shopMenu.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          toast('컴퓨터 업체 계정으로 로그인하면 매장 관리가 가능합니다.');
        };
      }
    }

    // '관리자 설정'은 최고관리자 전용입니다.
    // 업체 계정에서 이 메뉴를 눌러도 업체 화면으로 보내지 않습니다.
    if (adminMenu) {
      if (role === 'admin') {
        adminMenu.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          go('/admin.html');
        };
      } else if (role === 'shop') {
        adminMenu.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          toast('최고 관리자 계정만 이용할 수 있습니다.');
        };
      } else {
        adminMenu.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          toast('최고 관리자 계정만 이용할 수 있습니다.');
        };
      }
    }
  };

  const check = async () => {
    const token = getToken();
    if (!token) return bind(null);
    try {
      const r = await fetch('/api/auth/me', {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store'
      });
      if (!r.ok) throw new Error('인증 실패');
      const { user } = await r.json();
      bind(user);
    } catch (e) {
      bind(null);
    }
  };

  // 다른 메뉴 스크립트보다 늦게 실행되어도 최종 권한을 덮어씁니다.
  check();
  setTimeout(check, 300);
  setTimeout(check, 1000);
  setTimeout(check, 2000);
})();
