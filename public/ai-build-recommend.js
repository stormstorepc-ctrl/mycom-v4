(() => {
  'use strict';

  const money = n => '₩' + Number(n || 0).toLocaleString('ko-KR');
  const cleanBudget = () => {
    const text = document.getElementById('budgetValue')?.innerText || '';
    const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) ? n : 1500000;
  };

  function usageType() {
    const text = document.querySelector('.usage-card.active strong')?.innerText || '게임용';
    if (/영상|편집|프리미어|애프터|3d|렌더/i.test(text)) return 'video';
    if (/사무|업무|문서|일반/i.test(text)) return 'office';
    if (/ai|딥러닝|머신|개발|llm/i.test(text)) return 'ai';
    return 'game';
  }

  const fallback = {
    game: { title:'가성비 게이밍 PC', cpu:'Ryzen 5 7500F', gpu:'RTX 4060 8GB', ram:'DDR5 32GB', ssd:'NVMe 1TB', board:'B650M', psu:'650W 80+ Bronze', cooler:'싱글타워 공랭', total:1190000 },
    video: { title:'영상편집 실속 PC', cpu:'Ryzen 7 7700', gpu:'RTX 5060 Ti 16GB', ram:'DDR5 64GB', ssd:'NVMe 1TB', board:'B650M', psu:'750W 80+ Gold', cooler:'듀얼타워 공랭', total:1490000 },
    office: { title:'쾌적한 업무용 PC', cpu:'Ryzen 5 7600', gpu:'내장 그래픽', ram:'DDR5 32GB', ssd:'NVMe 1TB', board:'B650M', psu:'600W', cooler:'싱글타워 공랭', total:890000 },
    ai: { title:'AI 개발·생성형 AI PC', cpu:'Ryzen 9 9900X', gpu:'RTX 5070 Ti 16GB', ram:'DDR5 64GB', ssd:'NVMe 2TB', board:'B850M', psu:'850W 80+ Gold', cooler:'360mm 수랭', total:2190000 }
  };

  function removePriceNoise(root) {
    root.querySelectorAll('[data-ai-recommend-note], [data-ai-price-detail]').forEach(el => el.remove());
    root.querySelectorAll('.price-result p').forEach(p => p.remove());
    root.querySelectorAll('.price-value').forEach(el => {
      const parent = el.parentElement;
      if (parent) {
        [...parent.childNodes].forEach(node => {
          if (node.nodeType === 1 && /예상|견적/i.test(node.textContent || '') && node !== el) node.remove();
          if (node.nodeType === 3 && /예상 견적|예상가/i.test(node.textContent || '')) node.remove();
        });
      }
    });
  }

  function apply(rec, budget, type, label) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('recommend')?.classList.add('active');
    window.scrollTo(0, 0);

    const root = document.getElementById('recommend');
    if (!root) return;

    root.querySelector('.price-result h2')?.replaceChildren(document.createTextNode(rec.title || 'MYCOM 추천 PC'));
    const priceValue = root.querySelector('.price-value');
    if (priceValue) {
      priceValue.textContent = money(rec.total);
      const labelEl = priceValue.parentElement?.querySelector('.price-label');
      if (labelEl) labelEl.textContent = '추천 PC 가격';
    }

    const specs = {
      CPU: rec.cpu,
      GPU: rec.gpu,
      RAM: rec.ram,
      SSD: rec.ssd,
      메인보드: rec.board,
      파워: rec.psu,
      쿨러: rec.cooler
    };
    root.querySelectorAll('.spec-row').forEach(row => {
      const key = row.querySelector('strong')?.innerText.trim();
      const value = row.querySelector('span');
      if (value && specs[key]) value.textContent = specs[key];
    });

    removePriceNoise(root);

    sessionStorage.setItem('mycom_ai_pc_recommendation', JSON.stringify({
      usage: type,
      usageLabel: label || '게임용',
      budget,
      recommendation: rec,
      createdAt: Date.now()
    }));
  }

  async function getLiveRecommendation(budget, type, label) {
    const token = localStorage.getItem('mycom_token') || localStorage.getItem('token');
    if (!token) throw new Error('로그인이 필요합니다.');
    const r = await fetch('/api/ai/pc-build-recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ budget, usage: type, usageLabel: label })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || '오늘의 가격을 조회하지 못했습니다.');
    return data.recommendation;
  }

  window.showRecommendation = async function () {
    const budget = cleanBudget();
    const type = usageType();
    const label = document.querySelector('.usage-card.active strong')?.innerText || '게임용';
    const button = Array.from(document.querySelectorAll('button')).find(b => /AI 추천 PC 보기/.test(b.innerText || ''));
    const original = button?.innerText;
    if (button) { button.disabled = true; button.innerText = '🔎 추천 구성 확인 중...'; }

    try {
      const live = await getLiveRecommendation(budget, type, label);
      apply({ ...live, source:'danawa' }, budget, type, label);
    } catch (error) {
      console.warn('실시간 추천 실패:', error);
      const rec = fallback[type] || fallback.game;
      apply({ ...rec, source:'fallback', date:new Date().toISOString().slice(0,10), status:'fallback' }, budget, type, label);
    } finally {
      if (button) { button.disabled = false; button.innerText = original || '✨ AI 추천 PC 보기'; }
    }
  };
})();
