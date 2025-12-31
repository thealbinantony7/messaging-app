# Read-Only Channels Implementation (V1)

## Overview
Implemented minimal read-only broadcast channels where only admins can send messages while other members can only read.

## Changes Made

### 1. Shared Types (`packages/shared/src/index.ts`)
- Updated `ConversationType` to include `'channel'`:
  ```typescript
  export type ConversationType = 'dm' | 'group' | 'channel';
  ```

### 2. Sidebar (`apps/web/src/components/layout/Sidebar.tsx`)
- Separated conversations into two categories: **Chats** and **Channels**
- Chats section shows DMs and groups
- Channels section shows channels (only when channels exist)
- Both sections are searchable and filterable

**Logic:**
```typescript
const chats = filteredConversations.filter(c => c.type === 'dm' || c.type === 'group');
const channels = filteredConversations.filter(c => c.type === 'channel');
```

### 3. ChatView (`apps/web/src/components/chat/ChatView.tsx`)
- Added channel support to `getDisplayInfo()`:
  - Shows channel name
  - Displays "X subscribers" as status
- Added `canSendMessages` check:
  - Returns `true` for DMs and groups
  - For channels: checks if user's role is `'admin'`
- Conditional input rendering:
  - If `canSendMessages` is `false`: Shows read-only hint
  - If `canSendMessages` is `true`: Shows normal input

**Permission Check:**
```typescript
const canSendMessages = useMemo(() => {
    if (!conversation || !user) return false;
    if (conversation.type !== 'channel') return true;
    const member = conversation.members.find(m => m.userId === user.id);
    return member?.role === 'admin';
}, [conversation, user]);
```

### 4. Styling (`apps/web/src/components/chat/ChatView.css`)
- Added `.chat-input-readonly` styles:
  - Centered text
  - Low contrast (opacity 0.7)
  - Italic font style
  - Subtle hint: "Only admins can send messages in this channel"

## Features

### ✅ Implemented
- Channel type distinction in shared types
- Separate "Channels" section in sidebar
- Read-only mode for non-admin channel members
- Subtle hint when input is disabled
- Channel header shows "X subscribers"

### ❌ Not Implemented (as per requirements)
- Replies/threads
- Reactions
- Permissions UI
- Moderation tools
- Channel creation UI (backend only)

## Testing

To test channels:
1. Create a channel via backend/database with `type = 'channel'`
2. Add members with different roles (`admin` vs `member`)
3. Login as admin → can send messages
4. Login as member → sees read-only hint

## Database Schema
Channels use the existing `conversations` table with:
- `type = 'channel'`
- `conversation_members.role = 'admin'` for creators
- `conversation_members.role = 'member'` for subscribers

## UI Behavior
- **Admins**: Full input with all features (attach, emoji, AI, send)
- **Members**: Centered text hint, no input controls
- **Sidebar**: Channels appear under separate "Channels" heading
- **Header**: Shows subscriber count instead of member count
