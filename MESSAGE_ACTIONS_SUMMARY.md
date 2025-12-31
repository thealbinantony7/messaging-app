# Message Actions Implementation

## Overview
Implemented Context Menu with Copy, Edit, and Delete actions for messages. Minimal isolated changes to existing codebase.

## Backend Changes (`apps/server/src/routes/messages.ts`)
- Added `PATCH /:id` endpoint for editing messages
  - Restricted to sender
  - 5-minute time limit enforced
  - Broadcasts `message_updated` via Redis
- Added `DELETE /:id` endpoint for deleting messages
  - Restricted to sender
  - Soft delete (sets `deleted_at`)
  - Broadcasts `message_deleted` via Redis

## Frontend Changes

### API (`apps/web/src/lib/api.ts`)
- Added `editMessage(id, content)`
- Added `deleteMessage(id)`

### Store (`apps/web/src/stores/chat.ts`)
- Added `handleMessageUpdated`: Updates message content and `editedAt` locally
- Added `handleMessageDeleted`: Sets `deletedAt` locally (shows "This message was deleted")
- Wired up WebSocket handlers in `ChatLayout.tsx`

### UI (`apps/web/src/components/chat/MessageBubble.tsx`)
- Added right-click context menu (Desktop) / Long-press (Mobile, via `onContextMenu`)
- **Actions**:
  - **Copy**: Copies text to clipboard
  - **Edit**: Switches bubble to inline input (Sender only, < 5 mins)
  - **Delete**: Soft deletes message (Sender only)
- **Edit Mode**: Inline input with Save (Enter) / Cancel (Esc) / Action buttons
- **Styling**: Added context menu and edit input styles in `MessageBubble.css`

## Channel Rules
- Inherits "Sender only" logic. Since only admins can post in channels, only admins can delete/edit their posts. Members are effectively read-only.

## Files Touched
- `apps/server/src/routes/messages.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/stores/chat.ts`
- `apps/web/src/components/layout/ChatLayout.tsx`
- `apps/web/src/components/chat/MessageBubble.tsx`
- `apps/web/src/components/chat/MessageBubble.css`
