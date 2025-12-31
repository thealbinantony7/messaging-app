# Message Failure Handling & Retry - Implementation

## Overview
Implemented robust message failure handling with retry functionality for graceful error recovery.

## Message States

### 1. **sending**
- Initial state when message is created
- Shows clock icon with pulsing animation
- Message is in `pendingMessages` array

### 2. **sent**
- Message successfully acknowledged by server
- Shows single checkmark
- Still in `pendingMessages` until `new_message` event moves it to permanent storage

### 3. **failed**
- Message failed to send (WebSocket error, network issue, etc.)
- Shows alert icon (red)
- Message bubble has reduced opacity (0.85)
- Retry button appears in message footer

## Implementation Details

### Store (`apps/web/src/stores/chat.ts`)

**sendMessage:**
- Creates pending message with `status: 'sending'`
- Adds to `pendingMessages[conversationId]`
- Sends via WebSocket

**retryMessage:**
- Finds failed message by ID
- Updates status back to `sending`
- Resends using **original message ID** (prevents duplicates)
- Reuses existing message content and metadata

**handleMessageAck:**
- Receives acknowledgment from server
- If `status === 'error'`: Updates message to `failed`
- If success: Updates to `sent`
- Searches pending messages to find correct conversation

### Component (`apps/web/src/components/chat/MessageBubble.tsx`)

**Props:**
- Added `onRetry?: () => void` callback

**Rendering:**
- Shows retry button only when `status === 'failed'` AND `onRetry` is provided
- Retry button: Red tinted background, rotate icon, "Retry" text
- Failed messages have `failed` class for styling

**Status Icons:**
- `sending`: Clock icon with pulse animation
- `sent`: Single check
- `delivered`: Double check
- `read`: Double check (highlighted)
- `failed`: Alert circle (red)

### ChatView (`apps/web/src/components/chat/ChatView.tsx`)

**handleRetry:**
- Calls `retryMessage(conversationId, messageId)`
- Passed to MessageBubble as `onRetry` prop
- Only attached to failed messages

## Retry Flow

```
1. User sends message
   ↓
2. Status: 'sending' (clock icon, pulsing)
   ↓
3. WebSocket fails / timeout
   ↓
4. handleMessageAck receives error
   ↓
5. Status: 'failed' (alert icon, retry button)
   ↓
6. User clicks "Retry"
   ↓
7. Status: 'sending' (reusing original ID)
   ↓
8. WebSocket sends with same message ID
   ↓
9. Success: Status 'sent' → moves to permanent storage
```

## Key Features

✅ **No Duplicates**: Retry uses original message ID
✅ **Graceful Recovery**: Failed messages stay visible with retry option
✅ **Visual Feedback**: Clear status indicators (sending/sent/failed)
✅ **Subtle UI**: Retry button only appears on failed messages
✅ **Reliable**: Handles network issues and WebSocket errors

## Styling

### Failed Message
```css
.message-bubble.failed {
    opacity: 0.85;
}
```

### Retry Button
```css
.message-retry-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
}
```

### Sending Animation
```css
.message-status-icon.sending {
    opacity: 0.5;
    animation: pulse 2s ease-in-out infinite;
}
```

## Error Scenarios Handled

1. **WebSocket disconnected**: Message stays in pending with 'sending' status
2. **Server error**: Receives error ack, shows retry
3. **Network timeout**: No ack received, message remains 'sending'
4. **Retry success**: Reuses ID, no duplicate created
5. **Multiple retries**: Each retry resets to 'sending', then success/fail

## No Added Features

❌ No toasts or notifications
❌ No modals or dialogs
❌ No complex animations (only subtle pulse)
❌ No auto-retry logic
❌ No retry counters or limits

## Focus

✅ **Reliability**: Messages don't disappear on failure
✅ **Recovery**: User can manually retry
✅ **Clarity**: Clear visual feedback of message state
✅ **Simplicity**: Minimal UI, maximum functionality

The implementation provides robust error handling while maintaining a clean, professional interface.
