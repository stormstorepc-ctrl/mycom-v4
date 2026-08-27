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

  function apply(rec, budget, type, label) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('recommend')?.classList.add('active');
    window.scrollTo(0, 0);

    const root = document.getElementById('recommend');
    if (!root) return;
    root.querySelector('.price-result h2')?.replaceChildren(document.createTextNode(rec.title || 'AI 추천 구성'));
    const priceValue = root.querySelector('.price-value');
    if (priceValue) priceValue.textContent = money(rec.total);

    const priceNote = root.querySelector('.price-result p');
    if (priceNote) priceNote.textContent = `선택 용도: ${label || '게임용'} · 입력 예산 ${money(budget)} 기준`;

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

    const box = root.querySelector('.info-box');
    if (box) {
      let note = box.querySelector('[data-ai-recommend-note]');
      if (!note) {
        note = document.createElement('p');
        note.dataset.aiRecommendNote = '1';
        note.style.cssText = 'margin:16px 0 0;font-size:12px;color:var(--sub);line-height:1.6';
        box.appendChild(note);
      }
      const source = rec.source === 'danawa' ? '다나와 카드 최저가 참고' : '예상 참고가';
      note.textContent = `※ ${source} · 기준일 ${rec.date || new Date().toISOString().slice(0,10)} · 실제 가격/재고/카드 할인 조건에 따라 변동될 수 있습니다.`;
    }

    // 상세 부품 가격이 반환되면 추천표 아래에 가격 근거를 표시
    let detail = root.querySelector('[data-ai-price-detail]');
    if (Array.isArray(rec.components)) {
      if (!detail) {
        detail = document.createElement('div');
        detail.dataset.aiPriceDetail = '1';
        detail.className = 'info-box';
        root.appendChild(detail);
      }
      const rows = rec.components.map(c => {
        const p = Number.isFinite(Number(c.price)) && Number(c.price) > 0 ? money(c.price) : '확인 불가';
        const link = c.sourceUrl ? ` <a href="${String(c.sourceUrl).replace(/&/g,'&amp;').replace(/\"/g,'&quot;')}" target="_blank" rel="noopener" style="font-size:11px">다나와</a>` : '';
        return `<div class="spec-row"><strong>${escapeHtml(c.category)}</strong><span>${escapeHtml(c.name)} · ${p}${link}</span></div>`;
      }).join('');
      detail.innerHTML = `<div style="font-weight:900;margin-bottom:12px">📊 당일 가격 참고 내역</div>${rows}<p style="margin:12px 0 0;font-size:11px;color:var(--sub)">카드 최저가를 우선 참고했으며, 일부 상품은 카드 종류·판매처·배송비 조건에 따라 달라질 수 있습니다.</p>`;
    } else if (detail) {
      detail.remove();
    }

    sessionStorage.setItem('mycom_ai_pc_recommendation', JSON.stringify({
      usage: type,
      usageLabel: label || '게임용',
      budget,
      recommendation: rec,
      createdAt: Date.now()
    }));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[m]));
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
    if (button) { button.disabled = true; button.innerText = '🔎 오늘의 다나와 가격 확인 중...'; }

    try {
      const live = await getLiveRecommendation(budget, type, label);
      apply({ ...live, source:'danawa' }, budget, type, label);
    } catch (error) {
      console.warn('실시간 다나와 견적 실패:', error);
      // 실시간 조회 실패 시 임의의 "오늘 가격"이라고 표시하지 않고 안전한 예상 구성만 사용
      const rec = fallback[type] || fallback.game;
      apply({ ...rec, source:'fallback', date:new Date().toISOString().slice(0,10), status:'fallback' }, budget, type, label);
      const note = document.querySelector('#recommend [data-ai-recommend-note]');
      if (note) note.textContent = `※ 오늘의 다나와 가격을 실시간 확인하지 못해 참고용 예상가를 표시합니다. 실제 가격·재고 확인이 필요합니다.`;
    } finally {
      if (button) { button.disabled = false; button.innerText = original || '✨ AI 추천 PC 보기'; }
    }
  };
})();
