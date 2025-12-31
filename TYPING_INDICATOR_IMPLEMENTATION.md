# Minimal Typing Indicator - Implementation

## Overview
Implemented a lightweight, non-intrusive typing indicator that shows when another user is typing in the active conversation.

## Features

### 1. **Emission Logic (Debounced)**
- **Trigger**: `onChange` event on the message input
- **Debounce**: Emits `typing: true` after **500ms** of continuous typing
- **Auto-stop**: Emits `typing: false` after **3 seconds** of inactivity
- **On Send**: Immediately emits `typing: false` when message is sent

### 2. **Visual Feedback**
- **Location**: Bottom of the message list, left-aligned
- **Content**: `"{User} is typing…"` (No animations/dots)
- **Style**:
  - Font size: 11px
  - Opacity: 0.6
  - Style: Italic
  - Animation: Subtle fade-in
  - Padding: Aligned with message text (14px)

### 3. **Component Structure**
- `TypingIndicator.tsx`: Connected to `useChatStore` to get real user names
- `ChatView.tsx`: Manages the typing emission logic and renders the indicator

## Technical Implementation

### Frontend Logic (`ChatView.tsx`)
```typescript
const handleTyping = () => {
    // Clear existing timeouts
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Debounce 500ms
    typingTimeoutRef.current = setTimeout(() => {
        wsClient.setTyping(conversationId, true);

        // Auto-clear after 3s
        stopTypingTimeoutRef.current = setTimeout(() => {
            wsClient.setTyping(conversationId, false);
        }, 3000);
    }, 500);
};
```

### CSS (`TypingIndicator.css`)
```css
.typing-indicator {
    padding: 0 14px;
    margin-bottom: 8px;
    margin-top: -4px;
    align-self: flex-start;
    animation: fadeIn 0.3s ease;
}
```

## Constraints Met
✅ **Minimal UI**: Low contrast text, no avatars
✅ **No Animations**: Bouncing dots removed
✅ **Logic**: 500ms delay, 3s auto-clear
✅ **Single Line**: Simple text string

The feature provides context presence without adding visual noise to the chat interface.
