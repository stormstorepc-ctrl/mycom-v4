require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await pool.query(schema);
        console.log('✅ 데이터베이스 스키마 생성 완료');
    } catch (error) {
        console.error('❌ 데이터베이스 초기화 실패:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    initDatabase();
}

module.exports = initDatabase;
