# Cross-User Messaging Fix - Summary

## Problem
Messages sent by another user were not appearing in the active conversation in real-time.

## Root Cause
**Stale Closure in WebSocket Event Handler**

The `ChatLayout.tsx` component was extracting `handleMessageAck` and `handleNewMessage` from the Zustand store and adding them to the `useEffect` dependency array:

```typescript
// BEFORE (BROKEN):
const { handleMessageAck, handleNewMessage } = useChatStore();

useEffect(() => {
    const unsubscribe = wsClient.onMessage((msg) => {
        switch (msg.type) {
            case 'new_message':
                handleNewMessage(msg.payload); // ❌ Stale reference!
                break;
        }
    });
    return unsubscribe;
}, [user, handleMessageAck, handleNewMessage]); // ❌ Causes re-subscription on every render
```

### Why This Failed:
1. **Stale Closures**: When `handleMessageAck` or `handleNewMessage` were extracted, they created new function references on each render
2. **Unnecessary Re-subscriptions**: The `useEffect` would re-run whenever these functions changed
3. **Old Handlers**: The WebSocket callback would keep calling old versions of the handlers with stale state
4. **Messages Dropped**: Incoming messages from other users would be processed by handlers with outdated state, causing them to be ignored or not added to the correct conversation

## Solution
**Use `useChatStore.getState()` Inside the Callback**

```typescript
// AFTER (FIXED):
useEffect(() => {
    const unsubscribe = wsClient.onMessage((msg) => {
        // ✅ Get fresh handlers on every message
        const { handleMessageAck, handleNewMessage } = useChatStore.getState();
        
        switch (msg.type) {
            case 'new_message':
                handleNewMessage(msg.payload); // ✅ Always uses latest handler!
                break;
        }
    });
    return unsubscribe;
}, [user]); // ✅ Only re-subscribe when user changes
```

### Why This Works:
1. **Fresh State**: `useChatStore.getState()` always returns the current store state
2. **Stable Subscription**: The WebSocket listener is only created once (when user logs in)
3. **Latest Handlers**: Every incoming message calls the most recent version of the handlers
4. **Correct State**: Messages are added to the correct conversation with up-to-date state

## Changes Made

### 1. `apps/web/src/components/layout/ChatLayout.tsx`
- Removed `handleMessageAck` and `handleNewMessage` from component-level destructuring
- Added `useChatStore.getState()` call inside the WebSocket message callback
- Removed handler functions from `useEffect` dependency array
- Added comprehensive logging for debugging

### 2. `apps/web/src/stores/chat.ts`
- Added detailed console logging to `handleNewMessage` to track message flow
- Logs show: message received, current state, whether message is duplicate, and final action

### 3. `apps/web/src/components/layout/Sidebar.tsx`
- Added logging to conversation subscription to verify WebSocket rooms are joined

## Verification

### Console Logs to Watch For:

When Bob sends a message to Alice, Alice's console should show:

```
[ChatLayout] WebSocket message received: new_message {type: "new_message", payload: {...}}
[ChatLayout] Handling new_message: {id: "...", conversationId: "...", senderId: "...", content: "..."}
[handleNewMessage] Received message: {messageId: "...", conversationId: "...", senderId: "...", content: "Hello from Bob"}
[handleNewMessage] Current state: {conversationId: "...", existingMessages: 2, pendingMessages: 0, allConversations: [...]}
[handleNewMessage] Message analysis: {isMyMessage: false, pendingCount: 0, messageAlreadyExists: false}
[handleNewMessage] ADDED message. New count: 3
```

### Expected Behavior:
✅ Messages from other users appear immediately in the active conversation
✅ Messages are stored in the correct conversation (based on `message.conversationId`)
✅ No duplicate messages
✅ No messages dropped
✅ Works across multiple tabs/windows

## Removing Logs (After Verification)

Once you've confirmed the fix works, remove the console.log statements from:
1. `ChatLayout.tsx` (lines with `console.log('[ChatLayout]'...)`)
2. `chat.ts` (lines with `console.log('[handleNewMessage]'...)`)
3. `Sidebar.tsx` (lines with `console.log('[Sidebar]'...)`)

## Technical Details

### Zustand Store Pattern
Zustand stores are stable singletons. The store object itself never changes, but the state inside it does. When you call `useChatStore()` in a component, you get a new object with the current state on every render. This is why extracting functions from the store and using them in callbacks can cause stale closures.

### Correct Patterns:
1. **For components**: Use selectors to extract only what you need
2. **For callbacks**: Use `useStore.getState()` to get fresh state
3. **For effects**: Don't include store functions in dependency arrays unless you want re-runs

### Related Zustand Documentation:
- https://github.com/pmndrs/zustand#selecting-multiple-state-slices
- https://github.com/pmndrs/zustand#reading-from-state-in-actions
