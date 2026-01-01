# Phase 3.1: Realtime Reliability Fixes (Completed)

We have addressed the critical realtime correctness bugs. The application should now reliably display messages, update the sidebar, and scroll correctly without requiring reloads.

## ✅ Fixes Implemented

### 1. WebSocket Subscription Race (Critical)
**Root Cause:** Subscriptions were skipped if the WS connected before conversations loaded, or were lost on reconnect.
**Fix (`ws.ts`):** 
- Added `subscribedConversations` Set to track active subscriptions.
- Implemented `ws.onopen` handler to automatically re-subscribe to all tracked conversations upon connection or reconnection.

### 2. Sidebar Stale State
**Root Cause:** `handleNewMessage` updated the chat view but ignored the conversation list state (last message, unread count).
**Fix (`chat.ts`):** 
- Updated `handleNewMessage` to also find the conversation in the list and update its `lastMessage`, `updatedAt`, and `unreadCount`.
- Moves the updated conversation to the top of the list.

### 3. Scroll Timing
**Root Cause:** `requestAnimationFrame` was firing before the DOM update was committed, causing scrolls to miss.
**Fix (`ChatView.tsx`):** 
- Removed `requestAnimationFrame`.
- Removed `smooth` behavior for new messages (changed to `auto` for instant stability).
- simplified the effect dependency to guarantee scroll on message count change.

### 4. Unread Badge Persistence
**Root Cause:** Backend query included user's own messages in unread count.
**Fix (`conversations.ts`):** 
- Added `AND m.sender_id != $1` to the unread count SQL query.
- Frontend includes optimistic `unreadCount: 0` update on view.

## 🧪 Verification Steps

Please test the following flows:

1.  **Realtime Receive:** Open two browsers/devices. User A sends message. User B should see it **instantly** without reload.
2.  **Sidebar Update:** When User A sends a message, User B's sidebar should move User A to the top with the new message preview.
3.  **Scroll:** Sending/receiving messages should keep the view anchored to the bottom.
4.  **Unread Badge:** Opening a chat should clear the blue dot. Reloading should **not** brings it back.
5.  **Reconnect:** Turn off Wi-Fi/Network, wait 5s, turn back on. App should reconnect and fetch missing messages (via re-sub).

## Next Steps
Once reliability is confirmed, we can proceed to **Phase 3.2: UI Polish** (if needed).
