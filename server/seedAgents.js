// Seed script to create 30 agents for the website
import bcrypt from 'bcryptjs';
import { authDbPromise } from './db.js';

async function seedAgents() {
    const db = await authDbPromise;

    // Create table if not exists (in case)
    await db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT,
            role TEXT DEFAULT 'user',
            account_type TEXT DEFAULT 'individual',
            google_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Generate 30 agents
    const agents = [];
    for (let i = 1; i <= 30; i++) {
        const paddedNum = String(i).padStart(2, '0');
        const rawPassword = `Agent@${paddedNum}`;
        const hashedPassword = bcrypt.hashSync(rawPassword, 10);
        agents.push({
            name: `وكيل ${i}`,
            email: `agent${paddedNum}@alkuwait.com`,
            password: hashedPassword,
            phone: `77635${String(8960 + i)}`,
            role: 'agent'
        });
    }

    // Insert agents
    let insertedCount = 0;
    for (const agent of agents) {
        try {
            await db.run(
                `INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)`,
                [agent.name, agent.email, agent.password, agent.phone, agent.role]
            );
            insertedCount++;
            console.log(`✅ Created: ${agent.email}`);
        } catch (err) {
            if (err.message.includes('UNIQUE')) {
                console.log(`⚠️ Already exists: ${agent.email}`);
            } else {
                console.error(`❌ Error creating ${agent.email}:`, err.message);
            }
        }
    }

    console.log(`\n🎉 Done! Created ${insertedCount} new agents.`);

    // Show all agents (id, name, email, role) - never show password
    const allAgents = await db.all("SELECT id, name, email, role FROM users WHERE role = 'agent'");
    console.log('\n📋 All Agents:');
    console.table(allAgents);
}

seedAgents().catch(console.error);
