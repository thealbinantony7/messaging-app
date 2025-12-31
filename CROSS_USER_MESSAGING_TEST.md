# Manual Test for Cross-User Messaging

## Setup
1. Open two browser windows/tabs side by side
2. Open DevTools Console in both tabs (F12)

## Test Steps

### Window 1 - Alice
1. Navigate to `http://localhost:5173`
2. Clear localStorage: `localStorage.clear()` in console
3. Reload page
4. Login as `alice@example.com` / `password123`
5. Click on Bob's conversation (or create one if needed)
6. **Keep console open and watch for logs**

### Window 2 - Bob
1. Navigate to `http://localhost:5173`
2. Clear localStorage: `localStorage.clear()` in console
3. Reload page
4. Login as `bob@example.com` / `password123`
5. Click on Alice's conversation
6. Type: "Hello from Bob - testing cross-user messaging"
7. Press Enter to send

### Verification in Window 1 - Alice
**Expected Console Logs:**
```
[ChatLayout] WebSocket message received: new_message {...}
[ChatLayout] Handling new_message: {...}
[handleNewMessage] Received message: {messageId: "...", conversationId: "...", senderId: "...", content: "Hello from Bob - testing cross-user messaging"}
[handleNewMessage] Current state: {conversationId: "...", existingMessages: X, ...}
[handleNewMessage] Message analysis: {isMyMessage: false, ...}
[handleNewMessage] ADDED message. New count: X+1
```

**Expected UI:**
- Bob's message should appear in Alice's chat window immediately
- Message should have Bob's avatar/name
- Message should be on the left side (not Alice's side)

## What the Fix Does

The previous code had a **stale closure** problem:
- `handleMessageAck` and `handleNewMessage` were extracted in the component
- They were added to the `useEffect` dependency array
- This caused the WebSocket listener to be recreated on every render
- The old listener kept references to old versions of the handlers

The fix:
- Removes handlers from dependency array
- Gets handlers directly from `useChatStore.getState()` inside the message callback
- This ensures we always call the latest version of the handlers
- Messages from other users are now processed correctly

## If It Still Doesn't Work

Check console for:
1. Are WebSocket messages being received? Look for `[ChatLayout] WebSocket message received`
2. Is `handleNewMessage` being called? Look for `[handleNewMessage] Received message`
3. Is the message being added? Look for `[handleNewMessage] ADDED message`
4. Any errors or "SKIPPED" messages?
