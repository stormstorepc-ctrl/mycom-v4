/* MYCOM PARTNER bridge: keeps legacy index.html unchanged */
(function () {
  function isPartner(user) {
    if (!user) return false;
    const role = String(user.role || '').toLowerCase();
    return ['shop','partner','admin','owner'].includes(role);
  }

  function openPartner() {
    if (!window.currentUser) {
      if (typeof window.showToast === 'function') window.showToast('업체 로그인이 필요합니다.');
      if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
      return;
    }
    if (!isPartner(window.currentUser)) {
      if (typeof window.showToast === 'function') window.showToast('업체 계정으로 로그인한 경우에만 매장 관리가 가능합니다.');
      return;
    }
    location.href = '/partner.html';
  }

  window.openPartnerDashboard = openPartner;

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.menu-item').forEach(function (item) {
      const label = (item.textContent || '').replace(/\s+/g, '');
      if (label.includes('내매장관리') || label.includes('관리자설정')) {
        item.onclick = openPartner;
      }
    });

    const originalSubmitLogin = window.submitLogin;
    window.submitLogin = async function () {
      const emailEl = document.getElementById('loginEmail');
      const passwordEl = document.getElementById('loginPassword');
      const errorEl = document.getElementById('loginError');
      const email = emailEl ? emailEl.value.trim() : '';
      const password = passwordEl ? passwordEl.value : '';
      if (errorEl) errorEl.textContent = '';
      if (!email || !password) {
        if (errorEl) errorEl.textContent = '이메일과 비밀번호를 입력해주세요.';
        return;
      }
      try {
        const data = await window.apiCall('/auth/login', 'POST', { email: email, password: password });
        window.token = data.token;
        localStorage.setItem('mycom_token', data.token);
        window.currentUser = data.user;
        if (typeof window.updateUserUI === 'function') window.updateUserUI();
        if (typeof window.closeAuthModal === 'function') window.closeAuthModal();
        if (isPartner(data.user)) {
          location.href = '/partner.html';
          return;
        }
        if (typeof window.showToast === 'function') window.showToast((data.user.name || '') + '님 환영합니다!');
      } catch (error) {
        if (errorEl) errorEl.textContent = error.message || '로그인에 실패했습니다.';
      }
    };

    if (location.hash === '#partner') openPartner();
  });
})();
