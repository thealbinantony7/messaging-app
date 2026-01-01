import { hash } from 'bcryptjs';
import { pool } from '../lib/db.js';
import { logger } from '../lib/logger.js';

async function seed() {
  logger.info('Seeding database with test data...');

  try {
    const passwordHash = await hash('password', 10);

    // 1. Upsert Users and get their actual IDs
    logger.info('Upserting users...');
    const usersToSeed = [
      { email: 'alice@example.com', name: 'Alice Smith', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice', status: 'Hey there!' },
      { email: 'bob@example.com', name: 'Bob Johnson', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob', status: 'Available' },
      { email: 'charlie@example.com', name: 'Charlie Brown', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie', status: null },
    ];

    const userMap = new Map<string, string>(); // email -> id

    for (const user of usersToSeed) {
      const res = await pool.query(`
                INSERT INTO users (email, password_hash, display_name, avatar_url, status)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (email) DO UPDATE SET password_hash = $2
                RETURNING id;
            `, [user.email, passwordHash, user.name, user.avatar, user.status]);

      userMap.set(user.email, res.rows[0].id);
    }

    logger.info({ count: userMap.size }, 'Users synced');

    // Helpers
    const aliceId = userMap.get('alice@example.com');
    const bobId = userMap.get('bob@example.com');
    const charlieId = userMap.get('charlie@example.com');

    if (!aliceId || !bobId || !charlieId) {
      throw new Error('Failed to resolve all user IDs');
    }

    // 2. DM Conversation (Alice & Bob)
    let dmId: string;
    // Check if DM exists between Alice and Bob
    const existingDm = await pool.query(`
            SELECT c.id FROM conversations c
            JOIN conversation_members cm1 ON c.id = cm1.conversation_id
            JOIN conversation_members cm2 ON c.id = cm2.conversation_id
            WHERE c.type = 'dm' AND cm1.user_id = $1 AND cm2.user_id = $2
            LIMIT 1;
        `, [aliceId, bobId]);

    if (existingDm.rowCount && existingDm.rowCount > 0) {
      dmId = existingDm.rows[0].id;
    } else {
      const res = await pool.query(`INSERT INTO conversations (type) VALUES ('dm') RETURNING id`);
      dmId = res.rows[0].id;

      await pool.query(`
                INSERT INTO conversation_members (conversation_id, user_id, role)
                VALUES ($1, $2, 'member'), ($1, $3, 'member')
            `, [dmId, aliceId, bobId]);

      // Seed messages for new DM
      await pool.query(`
                INSERT INTO messages (conversation_id, sender_id, content, type)
                VALUES 
                  ($1, $2, 'Hey Bob! How are you?', 'text'),
                  ($1, $3, 'Hi Alice! I''m doing great, thanks!', 'text'),
                  ($1, $2, 'Want to grab coffee later?', 'text');
            `, [dmId, aliceId, bobId]);
      logger.info('Created new DM conversation');
    }

    // 3. Group Conversation
    let groupId: string;
    const groupName = 'Project Team';
    const existingGroup = await pool.query(`SELECT id FROM conversations WHERE type = 'group' AND name = $1 LIMIT 1`, [groupName]);

    if (existingGroup.rowCount && existingGroup.rowCount > 0) {
      groupId = existingGroup.rows[0].id;
    } else {
      const res = await pool.query(`INSERT INTO conversations (type, name) VALUES ('group', $1) RETURNING id`, [groupName]);
      groupId = res.rows[0].id;

      await pool.query(`
                INSERT INTO conversation_members (conversation_id, user_id, role)
                VALUES 
                  ($1, $2, 'admin'),
                  ($1, $3, 'member'),
                  ($1, $4, 'member')
            `, [groupId, aliceId, bobId, charlieId]);

      await pool.query(`
                INSERT INTO messages (conversation_id, sender_id, content, type)
                VALUES 
                  ($1, $2, 'Welcome to the team chat!', 'system'),
                  ($1, $3, 'Thanks for adding me!', 'text'),
                  ($1, $4, 'Happy to be here 👋', 'text');
            `, [groupId, aliceId, bobId, charlieId]);
      logger.info('Created new Group conversation');
    }

    logger.info('✅ Database seeded successfully');
  } catch (err) {
    logger.error({ err }, '❌ Seeding failed');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
