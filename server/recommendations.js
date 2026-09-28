// Recommendation System API
// نظام التوصيات المستوحى من X

import { dbPromise } from './db.js';

// خوارزمية حساب نقاط التوصيات
export async function calculateRecommendationScore(db, userId, destination) {
    const weights = {
        view: 0.1,
        click: 0.3,
        booking: 1.0,
        favorite: 0.5,
        recency: 0.2
    };

    // الشعبية العامة
    const popularity = destination.popularity_score || 0;

    // تفاعلات المستخدم مع هذه الوجهة
    const userInteractions = await db.all(
        `SELECT interaction_type, created_at FROM user_interactions 
         WHERE user_id = ? AND destination_name = ?
         ORDER BY created_at DESC LIMIT 10`,
        [userId, destination.destination_name]
    );

    let userScore = 0;
    userInteractions.forEach(interaction => {
        const weight = weights[interaction.interaction_type] || 0.1;
        // تقليل الوزن مع الوقت (recency decay)
        const daysSince = (Date.now() - new Date(interaction.created_at).getTime()) / (1000 * 60 * 60 * 24);
        const recencyFactor = Math.exp(-daysSince / 30); // تضاؤل خلال 30 يوم
        userScore += weight * recencyFactor;
    });

    // النقاط النهائية
    return popularity * 0.4 + userScore * 0.6;
}

// API للحصول على التوصيات
export async function getRecommendations(userId, limit = 10) {
    const db = await dbPromise;

    // الحصول على جميع الوجهات
    const destinations = await db.all(
        `SELECT * FROM destination_popularity 
         ORDER BY popularity_score DESC`
    );

    // حساب النقاط لكل وجهة
    const scoredDestinations = await Promise.all(
        destinations.map(async (dest) => ({
            ...dest,
            recommendation_score: await calculateRecommendationScore(db, userId, dest)
        }))
    );

    // ترتيب حسب النقاط
    scoredDestinations.sort((a, b) => b.recommendation_score - a.recommendation_score);

    // إضافة تنويع (diversity)
    const diversified = [];
    const usedServiceTypes = new Set();
    
    for (const dest of scoredDestinations) {
        if (diversified.length >= limit) break;
        
        // السماح بوجهتين max من كل نوع خدمة
        const typeCount = diversified.filter(d => d.service_type === dest.service_type).length;
        if (typeCount < 2) {
            diversified.push(dest);
        }
    }

    // إذا لم نصل للحد المطلوب، نضيف الباقي
    if (diversified.length < limit) {
        for (const dest of scoredDestinations) {
            if (diversified.length >= limit) break;
            if (!diversified.find(d => d.id === dest.id)) {
                diversified.push(dest);
            }
        }
    }

    return diversified.slice(0, limit);
}

// تسجيل التفاعل
export   async function trackInteraction(userId, interactionType, destinationName, serviceType, metadata = {}) {
    const db = await dbPromise;

    // تسجيل التفاعل
    await db.run(
        `INSERT INTO user_interactions (user_id, interaction_type, destination_name, service_type, metadata)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, interactionType, destinationName, serviceType, JSON.stringify(metadata)]
    );

    // تحديث عدادات الوجهة
    const updateField = `${interactionType}_count`;
    await db.run(
        `INSERT INTO destination_popularity (destination_name, service_type, ${updateField})
         VALUES (?, ?, 1)
         ON CONFLICT(destination_name) DO UPDATE SET
         ${updateField} = ${updateField} + 1,
         last_updated = CURRENT_TIMESTAMP`,
        [destinationName, serviceType]
    );

    // إعادة حساب نقاط الشعبية
    await db.run(
        `UPDATE destination_popularity 
         SET popularity_score = (view_count * 0.1) + (click_count * 0.3) + 
                                (booking_count * 1.0) + (favorite_count * 0.5)
         WHERE destination_name = ?`,
        [destinationName]
    );

    return { success: true };
}

// الحصول على الوجهات الأكثر شعبية
export async function getPopularDestinations(limit = 10, serviceType = null) {
    const db = await dbPromise;

    let query = `SELECT * FROM destination_popularity 
                 ${serviceType ? 'WHERE service_type = ?' : ''}
                 ORDER BY popularity_score DESC LIMIT ?`;

    const params = serviceType ? [serviceType, limit] : [limit];
    return await db.all(query, params);
}
