async function analyzePC(pcData) {
    try {
        const basePrice = calculateBasePrice(pcData);
        const priceRange = calculatePriceRange(basePrice, pcData);
        const confidence = calculateConfidence(pcData);
        const factors = analyzeFactors(pcData);

        if (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) {
            try {
                const aiResult = await callAIAPI(pcData);
                if (aiResult) {
                    return {
                        ...aiResult,
                        basePrice,
                        priceRange,
                        confidence,
                        factors
                    };
                }
            } catch (aiError) {
                console.warn('AI API 호출 실패, 규칙 기반 결과 사용:', aiError.message);
            }
        }

        return {
            estimatedPrice: basePrice,
            priceRange,
            confidence,
            factors,
            analysisDate: new Date().toISOString()
        };
    } catch (error) {
        console.error('PC 분석 오류:', error);
        throw error;
    }
}

function calculateBasePrice(pcData) {
    const componentPrices = {
        cpu: {
            'i9-14900K': 650000, 'i9-13900K': 550000, 'i7-14700K': 450000,
            'i7-13700K': 380000, 'i5-14600K': 280000, 'i5-13600K': 250000,
            'Ryzen 9 7950X': 600000, 'Ryzen 9 7900X': 500000,
            'Ryzen 7 7800X3D': 450000, 'Ryzen 7 7700X': 350000,
            'Ryzen 5 7600X': 250000, 'Ryzen 5 5600X': 180000
        },
        gpu: {
            'RTX 4090': 2200000, 'RTX 4080 Super': 1500000, 'RTX 4080': 1300000,
            'RTX 4070 Ti Super': 1100000, 'RTX 4070 Ti': 900000,
            'RTX 4070 Super': 750000, 'RTX 4070': 650000,
            'RTX 5070 Ti': 1200000, 'RTX 5070': 900000,
            'RTX 4060 Ti': 500000, 'RTX 4060': 400000,
            'RX 7900 XTX': 1100000, 'RX 7800 XT': 600000,
            'RX 7700 XT': 500000, 'RX 7600': 350000
        },
        ram: {
            'DDR5 64GB': 300000, 'DDR5 32GB': 150000, 'DDR5 16GB': 80000,
            'DDR4 64GB': 200000, 'DDR4 32GB': 100000, 'DDR4 16GB': 50000
        },
        storage: {
            'NVMe 4TB': 400000, 'NVMe 2TB': 200000, 'NVMe 1TB': 100000,
            'SSD 2TB': 180000, 'SSD 1TB': 90000, 'SSD 500GB': 50000,
            'HDD 4TB': 120000, 'HDD 2TB': 70000
        }
    };

    let total = 0;
    let matchedComponents = 0;

    for (const [component, prices] of Object.entries(componentPrices)) {
        const value = pcData[component];
        if (value && prices[value]) {
            total += prices[value];
            matchedComponents++;
        }
    }

    if (pcData.cpu && !componentPrices.cpu[pcData.cpu]) total += 200000;
    if (pcData.gpu && !componentPrices.gpu[pcData.gpu]) total += 500000;
    if (pcData.ram && !componentPrices.ram[pcData.ram]) total += 100000;
    if (pcData.storage && !componentPrices.storage[pcData.storage]) total += 100000;

    const conditionMultiplier = {
        'excellent': 0.9,
        'good': 0.75,
        'fair': 0.6,
        'poor': 0.45
    };

    const multiplier = conditionMultiplier[pcData.condition_grade] || 0.7;
    
    const warrantyBonus = (pcData.warranty_remaining || 0) * 10000;

    return Math.round((total * multiplier + warrantyBonus) / 10000) * 10000;
}

function calculatePriceRange(basePrice, pcData) {
    const variance = 0.15;
    const min = Math.round(basePrice * (1 - variance) / 10000) * 10000;
    const max = Math.round(basePrice * (1 + variance) / 10000) * 10000;
    return { min, max };
}

function calculateConfidence(pcData) {
    let confidence = 70;

    const components = ['cpu', 'gpu', 'ram', 'storage', 'motherboard', 'power_supply', 'cooler', 'pc_case'];
    const providedCount = components.filter(c => pcData[c]).length;
    confidence += providedCount * 3;

    if (pcData.condition_grade) confidence += 5;
    if (pcData.purchase_date) confidence += 3;
    if (pcData.warranty_remaining !== undefined) confidence += 2;

    return Math.min(confidence, 98);
}

function analyzeFactors(pcData) {
    const factors = [];
    const highEndComponents = ['RTX 4090', 'RTX 4080', 'RTX 4070 Ti', 'RTX 5070 Ti', 'Ryzen 9', 'i9-', 'DDR5 64GB', 'NVMe 4TB'];

    for (const [component, value] of Object.entries(pcData)) {
        if (value && highEndComponents.some(high => value.includes(high))) {
            factors.push({
                type: 'positive',
                component,
                value,
                impact: '가격 상승 요인'
            });
        }
    }

    if (pcData.condition_grade === 'poor' || pcData.condition_grade === 'fair') {
        factors.push({
            type: 'negative',
            component: 'condition',
            value: pcData.condition_grade,
            impact: '상태에 따른 가격 하락'
        });
    }

    if (pcData.warranty_remaining === 0) {
        factors.push({
            type: 'negative',
            component: 'warranty',
            value: '보증기간 만료',
            impact: '보증 없음에 따른 가격 하락'
        });
    }

    return factors;
}

async function callAIAPI(pcData) {
    if (process.env.GEMINI_API_KEY) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `다음 PC 부품의 중고 시세를 분석해주세요: ${JSON.stringify(pcData)}. 예상 가격 범위와 근거를 JSON 형식으로 응답해주세요.`
                        }]
                    }]
                })
            });

            const data = await response.json();
            return parseAIResponse(data);
        } catch (error) {
            console.warn('Gemini API 오류:', error);
            return null;
        }
    }

    return null;
}

function parseAIResponse(data) {
    try {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return {
            aiAnalysis: text,
            estimatedPrice: null,
            priceRange: null,
            confidence: 85
        };
    } catch (error) {
        return null;
    }
}

module.exports = { analyzePC };
