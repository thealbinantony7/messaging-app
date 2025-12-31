import { pool } from '../lib/db.js';
import { logger } from '../lib/logger.js';

async function seed() {
    logger.info('Seeding database with test data...');

    try {
        // Create test users
        const users = await pool.query(`
      INSERT INTO users (id, phone, display_name, avatar_url, status)
      VALUES 
        ('00000000-0000-0000-0000-000000000001', '+11234567890', 'Alice Smith', null, 'Hey there!'),
        ('00000000-0000-0000-0000-000000000002', '+10987654321', 'Bob Johnson', null, 'Available'),
        ('00000000-0000-0000-0000-000000000003', '+11112223333', 'Charlie Brown', null, null)
      ON CONFLICT (phone) DO NOTHING
      RETURNING id, display_name;
    `);

        logger.info({ count: users.rowCount }, 'Created test users');

        // Create a DM conversation
        const dmConv = await pool.query(`
      INSERT INTO conversations (id, type)
      VALUES ('10000000-0000-0000-0000-000000000001', 'dm')
      ON CONFLICT DO NOTHING
      RETURNING id;
    `);

        if (dmConv.rowCount) {
            // Add members to DM
            await pool.query(`
        INSERT INTO conversation_members (conversation_id, user_id, role)
        VALUES 
          ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'member'),
          ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'member')
        ON CONFLICT DO NOTHING;
      `);

            // Add some messages
            await pool.query(`
        INSERT INTO messages (conversation_id, sender_id, content, type)
        VALUES 
          ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Hey Bob! How are you?', 'text'),
          ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Hi Alice! I''m doing great, thanks!', 'text'),
          ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Want to grab coffee later?', 'text');
      `);

            logger.info('Created DM conversation with messages');
        }

        // Create a group conversation
        const groupConv = await pool.query(`
      INSERT INTO conversations (id, type, name)
      VALUES ('10000000-0000-0000-0000-000000000002', 'group', 'Project Team')
      ON CONFLICT DO NOTHING
      RETURNING id;
    `);

        if (groupConv.rowCount) {
            // Add members to group
            await pool.query(`
        INSERT INTO conversation_members (conversation_id, user_id, role)
        VALUES 
          ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'admin'),
          ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'member'),
          ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'member')
        ON CONFLICT DO NOTHING;
      `);

            // Add some messages
            await pool.query(`
        INSERT INTO messages (conversation_id, sender_id, content, type)
        VALUES 
          ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Welcome to the team chat!', 'system'),
          ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Thanks for adding me!', 'text'),
          ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'Happy to be here 👋', 'text');
      `);

            logger.info('Created group conversation with messages');
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
