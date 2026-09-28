import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function initRecommendationsDB() {
    const db = await open({
        filename: './data.sqlite',
        driver: sqlite3.Database
    });

    console.log('📊 Initializing Recommendations System Database...');

    // قراءة وتنفيذ schema
    const fs = await import('fs/promises');
    const schema = await fs.readFile('./server/schema_recommendations.sql', 'utf-8');

    await db.exec(schema);

    console.log('✅ Recommendations tables created successfully!');
    console.log('✅ Initial destination data inserted!');

    // عرض إحصائيات
    const stats = await db.get('SELECT COUNT(*) as count FROM destination_popularity');
    console.log(`📍 Destinations in database: ${stats.count}`);

    await db.close();
}

initRecommendationsDB()
    .then(() => {
        console.log('\n🎉 Recommendations system initialized!');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });
