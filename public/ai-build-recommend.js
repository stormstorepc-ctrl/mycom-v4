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

  const tiers = {
    game: [
      { max: 800000, title: '가성비 게이밍 PC', cpu: 'Ryzen 5 5600', gpu: 'Radeon RX 6600 8GB', ram: 'DDR4 16GB', ssd: 'NVMe 500GB', board: 'B550', psu: '650W 80+ Bronze', cooler: '기본 쿨러', total: 790000 },
      { max: 1200000, title: 'FHD 게이밍 PC', cpu: 'Ryzen 5 7500F', gpu: 'RTX 4060 8GB', ram: 'DDR5 32GB', ssd: 'NVMe 1TB', board: 'B650M', psu: '650W 80+ Bronze', cooler: '싱글타워 공랭', total: 1190000 },
      { max: 1600000, title: 'QHD 게이밍 추천 PC', cpu: 'Ryzen 5 7600', gpu: 'RTX 5060 Ti 16GB', ram: 'DDR5 32GB', ssd: 'NVMe 1TB', board: 'B650M', psu: '750W 80+ Gold', cooler: '듀얼타워 공랭', total: 1590000 },
      { max: 2000000, title: '고성능 QHD 게이밍 PC', cpu: 'Ryzen 7 7800X3D', gpu: 'RTX 5070 12GB', ram: 'DDR5 32GB', ssd: 'NVMe 1TB', board: 'B650M', psu: '750W 80+ Gold', cooler: '듀얼타워 공랭', total: 1990000 },
      { max: 2600000, title: '하이엔드 게이밍 PC', cpu: 'Ryzen 7 9800X3D', gpu: 'RTX 5070 Ti 16GB', ram: 'DDR5 32GB', ssd: 'NVMe 2TB', board: 'B850M', psu: '850W 80+ Gold', cooler: '고성능 듀얼타워', total: 2590000 },
      { max: Infinity, title: '플래그십 게이밍 PC', cpu: 'Ryzen 7 9800X3D', gpu: 'RTX 5080 16GB', ram: 'DDR5 64GB', ssd: 'NVMe 2TB', board: 'B850M', psu: '850W 80+ Gold', cooler: '360mm 수랭', total: 3390000 }
    ],
    video: [
      { max: 1000000, title: '입문 영상편집 PC', cpu: 'Ryzen 5 7600', gpu: 'RTX 4060 8GB', ram: 'DDR5 32GB', ssd: 'NVMe 1TB', board: 'B650M', psu: '650W 80+ Bronze', cooler: '싱글타워 공랭', total: 990000 },
      { max: 1500000, title: '영상편집 실속 PC', cpu: 'Ryzen 7 7700', gpu: 'RTX 5060 Ti 16GB', ram: 'DDR5 64GB', ssd: 'NVMe 1TB', board: 'B650M', psu: '750W 80+ Gold', cooler: '듀얼타워 공랭', total: 1490000 },
      { max: 2000000, title: '4K 영상편집 PC', cpu: 'Ryzen 9 7900', gpu: 'RTX 5070 12GB', ram: 'DDR5 64GB', ssd: 'NVMe 2TB', board: 'B650M', psu: '750W 80+ Gold', cooler: '360mm 수랭', total: 1990000 },
      { max: 2700000, title: '전문 영상편집 PC', cpu: 'Ryzen 9 9900X', gpu: 'RTX 5070 Ti 16GB', ram: 'DDR5 64GB', ssd: 'NVMe 2TB', board: 'B850M', psu: '850W 80+ Gold', cooler: '360mm 수랭', total: 2690000 },
      { max: Infinity, title: '프로 영상·렌더링 PC', cpu: 'Ryzen 9 9950X', gpu: 'RTX 5080 16GB', ram: 'DDR5 64GB', ssd: 'NVMe 4TB', board: 'X870', psu: '1000W 80+ Gold', cooler: '360mm 수랭', total: 3490000 }
    ],
    office: [
      { max: 700000, title: '실속 사무용 PC', cpu: 'Ryzen 5 5600G', gpu: '내장 그래픽', ram: 'DDR4 16GB', ssd: 'NVMe 500GB', board: 'A520M', psu: '550W', cooler: '기본 쿨러', total: 690000 },
      { max: 1000000, title: '쾌적한 업무용 PC', cpu: 'Ryzen 5 7600', gpu: '내장 그래픽', ram: 'DDR5 32GB', ssd: 'NVMe 1TB', board: 'B650M', psu: '600W', cooler: '싱글타워 공랭', total: 890000 },
      { max: 1400000, title: '고성능 업무용 PC', cpu: 'Ryzen 7 7700', gpu: 'RTX 4060 8GB', ram: 'DDR5 32GB', ssd: 'NVMe 1TB', board: 'B650M', psu: '650W 80+ Bronze', cooler: '듀얼타워 공랭', total: 1290000 },
      { max: Infinity, title: '프리미엄 업무용 PC', cpu: 'Ryzen 7 9700X', gpu: 'RTX 5060 Ti 16GB', ram: 'DDR5 64GB', ssd: 'NVMe 2TB', board: 'B850M', psu: '750W 80+ Gold', cooler: '듀얼타워 공랭', total: 1690000 }
    ],
    ai: [
      { max: 1400000, title: '입문 AI 개발 PC', cpu: 'Ryzen 7 7700', gpu: 'RTX 4060 Ti 16GB', ram: 'DDR5 64GB', ssd: 'NVMe 1TB', board: 'B650M', psu: '750W 80+ Gold', cooler: '듀얼타워 공랭', total: 1390000 },
      { max: 2200000, title: 'AI 개발·생성형 AI PC', cpu: 'Ryzen 9 9900X', gpu: 'RTX 5070 Ti 16GB', ram: 'DDR5 64GB', ssd: 'NVMe 2TB', board: 'B850M', psu: '850W 80+ Gold', cooler: '360mm 수랭', total: 2190000 },
      { max: 3000000, title: '고성능 AI 개발 PC', cpu: 'Ryzen 9 9950X', gpu: 'RTX 5080 16GB', ram: 'DDR5 64GB', ssd: 'NVMe 2TB', board: 'X870', psu: '1000W 80+ Gold', cooler: '360mm 수랭', total: 2990000 },
      { max: Infinity, title: '대규모 AI·LLM 개발 PC', cpu: 'Ryzen 9 9950X', gpu: 'RTX 5090 32GB', ram: 'DDR5 96GB', ssd: 'NVMe 4TB', board: 'X870', psu: '1200W 80+ Gold', cooler: '360mm 수랭', total: 4890000 }
    ]
  };

  function choose(type, budget) {
    const list = tiers[type] || tiers.game;
    return list.find(x => budget <= x.max) || list[list.length - 1];
  }

  function renderRecommendation() {
    const budget = cleanBudget();
    const type = usageType();
    const rec = choose(type, budget);

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('recommend')?.classList.add('active');
    window.scrollTo(0, 0);

    const root = document.getElementById('recommend');
    if (!root) return;

    const title = root.querySelector('.price-result h2');
    if (title) title.textContent = rec.title;

    const priceValue = root.querySelector('.price-value');
    if (priceValue) priceValue.textContent = money(rec.total);

    const budgetNote = root.querySelector('.price-result p');
    if (budgetNote) budgetNote.textContent = `선택 용도: ${document.querySelector('.usage-card.active strong')?.innerText || '게임용'} · 입력 예산 ${money(budget)} 기준`;

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
      if (key && specs[key]) {
        const value = row.querySelector('span');
        if (value) value.textContent = specs[key];
      }
    });

    const box = root.querySelector('.info-box');
    if (box && !box.querySelector('[data-ai-recommend-note]')) {
      const note = document.createElement('p');
      note.dataset.aiRecommendNote = '1';
      note.style.cssText = 'margin:16px 0 0;font-size:12px;color:var(--sub);line-height:1.6';
      note.textContent = '※ 예산과 용도에 따라 AI 추천 등급을 변경합니다. 실제 판매 가격·재고에 따라 최종 가격은 달라질 수 있습니다.';
      box.appendChild(note);
    }

    sessionStorage.setItem('mycom_ai_pc_recommendation', JSON.stringify({
      usage: type,
      usageLabel: document.querySelector('.usage-card.active strong')?.innerText || '게임용',
      budget,
      recommendation: rec,
      createdAt: Date.now()
    }));
  }

  window.showRecommendation = renderRecommendation;
})();
