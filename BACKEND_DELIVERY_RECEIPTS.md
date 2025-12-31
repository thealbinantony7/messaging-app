# Backend Delivery Receipts Implementation

## Changes Made

### WebSocket Handler (`apps/server/src/ws/handler.ts`)

Added delivery receipt emission after broadcasting new messages:

```typescript
// After broadcasting new_message
const convInfo = await queryOne<{ type: string }>('SELECT type FROM conversations WHERE id = $1', [conversationId]);

if (convInfo && convInfo.type !== 'channel') {
    // Get other members who are online
    const otherMembers = await query<{ user_id: string }>('SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2', [conversationId, userId]);
    
    // Send delivery receipt for each online member
    for (const member of otherMembers) {
        if (isUserOnline(member.user_id)) {
            await broadcastToConversation(conversationId, {
                type: 'delivery_receipt',
                payload: {
                    conversationId,
                    userId: member.user_id,
                    messageId: id,
                },
            });
        }
    }
}
```

## How It Works

1. **User A sends message** → Message is saved to database
2. **Server broadcasts `new_message`** → All members receive the message
3. **Server checks conversation type** → Skip if channel
4. **Server queries other members** → Get all members except sender
5. **For each online member** → Check if they have active WebSocket connection
6. **Emit `delivery_receipt`** → Broadcast to conversation with member's userId
7. **Sender receives receipt** → Frontend updates UI from single check to double check

## Behavior

### For DMs:
- When Bob receives Alice's message → Alice sees double check immediately (if Bob is online)
- If Bob is offline → Alice sees single check until Bob comes online

### For Groups:
- When any member receives the message → Sender sees double check
- Shows "delivered" if at least one member is online and received it

### For Channels:
- No delivery receipts emitted
- Always shows single check (sent only)

## Performance Considerations

- **Efficient online check**: Uses in-memory `userSockets` Map
- **Single query**: Gets all other members in one query
- **Conditional emission**: Only emits for online users
- **Type check**: Skips channels entirely

## Testing

1. Open two browser windows (Alice and Bob)
2. Alice sends message to Bob
3. **Expected behavior**:
   - Alice sees clock icon → single check → double check (instant if Bob is online)
   - Bob sees the message appear
4. If Bob is offline:
   - Alice sees single check only
   - When Bob comes online and opens the conversation, he'll see the message
   - (Future: could emit delivery receipt when Bob subscribes to conversation)

## Future Enhancements

Could add delivery receipt on subscription:
- When user subscribes to a conversation, emit delivery receipts for undelivered messages
- This would handle the "offline → online" transition
