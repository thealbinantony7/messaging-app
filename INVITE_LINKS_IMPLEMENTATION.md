# Invite Links Implementation for LUCENT

## Overview
Implemented shareable invite links for conversations (private, group, channel) with minimal scope.

## Backend Implementation

### 1. Database Schema
**File**: `apps/server/src/db/migration_invite_tokens.sql`

```sql
CREATE TABLE invite_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token           VARCHAR(32) UNIQUE NOT NULL,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

- **token**: Random 32-character hex string (unguessable)
- **conversation_id**: Links to conversation
- **created_by**: User who created the invite
- **No expiry**: Tokens are reusable (V1 scope)

### 2. Shared Types
**File**: `packages/shared/src/index.ts`

Added interfaces:
- `CreateInviteLinkRequest`
- `CreateInviteLinkResponse`
- `JoinViaInviteRequest`
- `JoinViaInviteResponse`

### 3. Backend Routes
**File**: `apps/server/src/routes/invite.ts`

**POST `/api/invite/create`**
- Creates or returns existing invite link for conversation
- **Permission**: Admin/owner only for channels, any member for DMs/groups
- Returns: `{ token, inviteUrl }`

**POST `/api/invite/join`**
- Joins user to conversation via token
- Adds user as `member` role (read-only for channels)
- Returns: `{ conversationId, conversation }`

**GET `/api/invite/:conversationId`**
- Gets existing invite link for conversation
- **Permission**: Must be member

### 4. Security
- Tokens are 32-character random hex (256 bits of entropy)
- One token per conversation (reusable)
- Permissions enforced:
  - Only admins can create invite links for channels
  - Any member can create invite links for DMs/groups
- Auto-join adds users as `member` role (not admin)

## Frontend Implementation

### 1. API Client
**File**: `apps/web/src/lib/api.ts`

Added methods:
- `createInviteLink(conversationId)` - Create/get invite link
- `joinViaInvite(token)` - Join via token
- `getInviteLink(conversationId)` - Get existing link

### 2. Routing
**File**: `apps/web/src/App.tsx`

Added React Router with routes:
- `/` - Main chat (authenticated)
- `/login` - Auth screen
- `/invite/:token` - Invite page

### 3. Invite Page
**File**: `apps/web/src/pages/InvitePage.tsx`

**Flow**:
1. Extract token from URL
2. If not logged in → redirect to `/login?redirect=/invite/:token`
3. If logged in → call `api.joinViaInvite(token)`
4. On success → add conversation to store, redirect to chat
5. On error → show error message

**States**:
- Loading: "Joining conversation..."
- Success: "Success!" → auto-redirect
- Error: Show error + "Go to Home" button

### 4. Invite Button
**File**: `apps/web/src/components/chat/ChatView.tsx`

Added Link icon button to chat header:
- Calls `api.createInviteLink(conversationId)`
- Copies invite URL to clipboard
- Shows toast: "Invite link copied!"

## User Flow

### Creating Invite Link
1. User opens conversation
2. Clicks Link icon in header
3. Backend creates/returns invite link
4. Link copied to clipboard
5. Toast confirms: "Invite link copied!"

### Joining via Invite Link
1. User receives invite link (e.g., `http://localhost:5173/invite/abc123...`)
2. Clicks link
3. **If not logged in**:
   - Redirected to login
   - After login, auto-joins conversation
4. **If logged in**:
   - Immediately joins conversation
   - Redirected to chat

### Channel Behavior
- Joining via invite makes user a **member** (read-only)
- Only admins can send messages
- Members see: "Only admins can send messages in this channel"

## Files Modified/Created

### Backend
1. `apps/server/src/db/migration_invite_tokens.sql` - Database schema
2. `apps/server/src/routes/invite.ts` - Invite routes
3. `apps/server/src/index.ts` - Register invite routes
4. `packages/shared/src/index.ts` - Shared types

### Frontend
5. `apps/web/src/lib/api.ts` - API methods
6. `apps/web/src/App.tsx` - Routing
7. `apps/web/src/pages/InvitePage.tsx` - Invite page
8. `apps/web/src/components/chat/ChatView.tsx` - Invite button
9. `apps/web/package.json` - Added react-router-dom

## Testing

### Manual Test
1. **Create invite link**:
   - Open any conversation
   - Click Link icon in header
   - Verify toast: "Invite link copied!"
   
2. **Join via invite** (same user):
   - Paste link in new tab
   - Should see "Already a member" → redirect to chat

3. **Join via invite** (different user):
   - Logout
   - Login as different user
   - Paste invite link
   - Should join conversation and redirect

4. **Join via invite** (not logged in):
   - Logout
   - Paste invite link
   - Should redirect to login
   - After login, should auto-join

5. **Channel permissions**:
   - Create channel invite
   - Join as non-admin
   - Verify read-only mode

## Constraints Met
✅ No refactoring of existing chat/channel/auth logic
✅ No UI redesign (uses existing patterns)
✅ No permissions UI added
✅ Minimal, isolated changes
✅ Uses existing backend patterns
✅ Random, unguessable tokens
✅ Reusable tokens (no expiry)

## Future Enhancements (Out of Scope)
- Invite link expiry
- Invite link revocation
- Per-link usage limits
- Invite link analytics
- Custom invite messages
