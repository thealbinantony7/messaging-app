# ✅ FIXED: Cross-User Message Rendering

## Problem
Messages sent by another user were stored in the Zustand store and visible in the sidebar, but **did not render in the active chat view**.

## Root Causes

### 1. **Stale Closure in WebSocket Handler** (Fixed Previously)
The WebSocket event handler was using stale references to store functions, causing messages to be processed with outdated state.

**Fix:** Use `useChatStore.getState()` inside the WebSocket callback to get fresh handlers.

### 2. **No Reactive Subscription in ChatView** (Main Issue - Fixed Now)
The ChatView was extracting store data with object destructuring, which only reads the store once per render.

```typescript
// ❌ BROKEN - No reactivity
const { messages } = useChatStore();
const conversationMessages = messages[conversationId];
```

When a new message arrived via WebSocket, the store updated but the component didn't re-render.

**Fix:** Use Zustand selectors with shallow equality:

```typescript
// ✅ FIXED - Reactive subscription
const { conversationMessages, pending, typing } = useChatStore(
    (state) => ({
        conversationMessages: state.messages[conversationId] || [],
        pending: state.pendingMessages[conversationId] || [],
        typing: state.typingUsers[conversationId] || [],
    }),
    shallow
);
```

### 3. **Excessive Re-renders**
Multiple individual selectors caused the component to re-render on every tiny state change.

**Fix:** Combine related state into a single selector with `shallow` equality comparison.

## Changes Made

### `apps/web/src/components/chat/ChatView.tsx`
- **Added:** `import { shallow } from 'zustand/shallow'`
- **Changed:** Combined all state selectors into one with shallow equality
- **Result:** Component re-renders only when messages/pending/typing actually change

### `apps/web/src/components/layout/ChatLayout.tsx`
- **Changed:** WebSocket handler uses `useChatStore.getState()` to avoid stale closures
- **Removed:** Debug logging

### `apps/web/src/stores/chat.ts`
- **Removed:** All debug logging from `handleNewMessage`

### `apps/web/src/components/layout/Sidebar.tsx`
- **Removed:** Debug logging from subscription

## How It Works Now

1. **Bob sends message** → WebSocket broadcasts to all clients
2. **Alice's browser receives** → WebSocket handler calls `handleNewMessage()`
3. **Store updates** → Creates new array: `[...currentMessages, newMessage]`
4. **Zustand detects change** → Shallow comparison sees new array reference
5. **ChatView re-renders** → Selector returns updated messages
6. **UI updates** → New message appears immediately

## Verification

✅ Messages from other users appear **immediately** in real-time  
✅ No duplicate messages  
✅ Messages persist after reload  
✅ Sidebar and ChatView both update  
✅ No excessive re-renders  
✅ No console spam  
✅ Works across multiple tabs/windows  

## Key Concepts

### Zustand Shallow Equality
```typescript
// Without shallow - re-renders on every state change
const data = useChatStore((state) => ({
    messages: state.messages[id],
    pending: state.pendingMessages[id]
}));

// With shallow - only re-renders when values change
const data = useChatStore(
    (state) => ({
        messages: state.messages[id],
        pending: state.pendingMessages[id]
    }),
    shallow
);
```

`shallow` compares object properties:
- If `messages` array reference changes → re-render
- If `messages` array is same reference → no re-render
- Prevents re-renders from unrelated state changes

### Why It's Important
- **Performance:** Prevents unnecessary re-renders
- **Correctness:** Ensures UI updates when data changes
- **Reactivity:** Components automatically sync with store

## Testing
1. Open two browser windows
2. Login as Alice in one, Bob in the other
3. Bob sends a message
4. Alice sees it **immediately** without reload

## Files to Review
- `apps/web/src/components/chat/ChatView.tsx` - Main fix
- `apps/web/src/components/layout/ChatLayout.tsx` - WebSocket handler
- `apps/web/src/stores/chat.ts` - Store logic

All debug logs have been removed. The app is production-ready.
