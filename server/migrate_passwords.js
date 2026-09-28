import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authDbPromise } from './db.js';

async function migratePasswords() {
    const db = await authDbPromise;

    console.log('--- Starting SEC-01 Password Migration ---');

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
        const users = await db.all('SELECT id, role, password FROM users');
        let migratedCount = 0;
        let skippedAlreadyHashed = 0;
        let oauthLockedCount = 0;

        for (const user of users) {
            const currentPass = user.password;

            // Idempotency: check if already hashed with bcrypt
            if (currentPass && (currentPass.startsWith('$2a$') || currentPass.startsWith('$2b$') || currentPass.startsWith('$2y$'))) {
                skippedAlreadyHashed++;
                continue;
            }

            // If it's a legacy static Google OAuth placeholder string
            if (currentPass === 'GOOGLE_LOGIN') {
                const lockedSecret = crypto.randomBytes(32).toString('hex');
                const lockedHash = bcrypt.hashSync(`OAUTH_LOCKED_${lockedSecret}`, 10);
                await db.run('UPDATE users SET password = ? WHERE id = ?', [lockedHash, user.id]);
                oauthLockedCount++;
                continue;
            }

            // Normal plaintext password
            const saltRounds = 10;
            const newHash = bcrypt.hashSync(currentPass, saltRounds);

            // Pre-commit verification: verify hash matches before saving
            const verifyMatch = bcrypt.compareSync(currentPass, newHash);
            if (!verifyMatch) {
                throw new Error(`Self-verification assertion failed for user id=${user.id}`);
            }

            // Update in DB
            await db.run('UPDATE users SET password = ? WHERE id = ?', [newHash, user.id]);
            migratedCount++;
        }

        // Commit transaction
        await db.run('COMMIT');

        console.log('✅ Migration Transaction Committed Successfully');
        console.log(`Total accounts scanned: ${users.length}`);
        console.log(`Accounts successfully hashed: ${migratedCount}`);
        console.log(`Accounts already hashed (skipped): ${skippedAlreadyHashed}`);
        console.log(`OAuth accounts locked: ${oauthLockedCount}`);

        // Post-migration validation: verify zero plaintext remains
        const allPostUsers = await db.all('SELECT id, password FROM users');
        const invalidHashes = allPostUsers.filter(u => !u.password || !(u.password.startsWith('$2a$') || u.password.startsWith('$2b$')));

        if (invalidHashes.length > 0) {
            throw new Error(`Integrity check failed: ${invalidHashes.length} accounts do not have a valid bcrypt hash.`);
        }

        console.log('✅ Post-migration integrity verification passed: 100% of accounts have bcrypt hashes.');
        return {
            total: users.length,
            migrated: migratedCount,
            skipped: skippedAlreadyHashed,
            oauthLocked: oauthLockedCount
        };
    } catch (err) {
        await db.run('ROLLBACK');
        console.error('❌ Migration failed, transaction rolled back:', err.message);
        throw err;
    }
}

// Execute if run directly
migratePasswords().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Fatal error during migration:', err.message);
    process.exit(1);
});

export { migratePasswords };
