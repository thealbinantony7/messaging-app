# Creating a Test Channel

## Option 1: Via Database (Quick Test)

Connect to your PostgreSQL database and run:

```sql
-- Create a channel conversation
INSERT INTO conversations (id, type, name, avatar_url, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'channel',
    'Announcements',
    NULL,
    NOW(),
    NOW()
) RETURNING id;

-- Add yourself as admin (replace USER_ID and CONVERSATION_ID)
INSERT INTO conversation_members (id, conversation_id, user_id, role, joined_at)
VALUES (
    gen_random_uuid(),
    'CONVERSATION_ID_FROM_ABOVE',
    'YOUR_USER_ID',
    'admin',
    NOW()
);

-- Add another user as member (optional)
INSERT INTO conversation_members (id, conversation_id, user_id, role, joined_at)
VALUES (
    gen_random_uuid(),
    'CONVERSATION_ID_FROM_ABOVE',
    'ANOTHER_USER_ID',
    'member',
    NOW()
);
```

## Option 2: Via Backend API (Recommended)

Add a route to create channels in `apps/server/src/routes/conversations.ts`:

```typescript
// POST /api/conversations/channels
router.post('/channels', authenticate, async (req, res) => {
    const { name } = req.body;
    const userId = req.user!.id;

    const conversationId = randomUUID();
    const memberId = randomUUID();

    await db.transaction(async (tx) => {
        // Create channel
        await tx.insert(conversations).values({
            id: conversationId,
            type: 'channel',
            name,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Add creator as admin
        await tx.insert(conversationMembers).values({
            id: memberId,
            conversationId,
            userId,
            role: 'admin',
            joinedAt: new Date(),
        });
    });

    res.json({ id: conversationId });
});
```

Then call it:
```bash
curl -X POST http://localhost:3001/api/conversations/channels \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Announcements"}'
```

## Quick Test with Existing Data

If you want to test immediately, you can convert an existing group to a channel:

```sql
UPDATE conversations 
SET type = 'channel' 
WHERE type = 'group' 
LIMIT 1;
```

After creating a channel, refresh the app and you'll see the "Channels" section appear in the sidebar!
