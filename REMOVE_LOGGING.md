# Remove Debug Logging

This file documents which console.log statements to remove after verifying the fix works.

## Files to Clean Up

### 1. apps/web/src/components/layout/ChatLayout.tsx

Remove these lines:
- Line ~30: `console.log('[ChatLayout] Setting up WebSocket listeners for user:', user.id);`
- Line ~32: `console.log('[ChatLayout] WebSocket message received:', msg.type, msg);`
- Line ~38: `console.log('[ChatLayout] Handling message_ack:', msg.payload);`
- Line ~42: `console.log('[ChatLayout] Handling new_message:', msg.payload);`

### 2. apps/web/src/stores/chat.ts

Remove these lines in `handleNewMessage` function:
- Lines ~293-299: First console.log block (Received message)
- Lines ~305-311: Second console.log block (Current state)
- Lines ~318-322: Third console.log block (Message analysis)
- Line ~335: `console.log('[handleNewMessage] SKIPPED - Message already exists');`
- Line ~349: `console.log('[handleNewMessage] ADDED message. New count:', ...);`

### 3. apps/web/src/components/layout/Sidebar.tsx

Remove these lines:
- Line ~25: `console.log('[Sidebar] Subscribing to conversations:', ...);`
- Line ~28: `console.log('[Sidebar] Subscription sent for', ...);`

## Quick Removal Commands

You can use these search/replace patterns in your editor:

### VS Code / Cursor
1. Open Find & Replace (Ctrl+H)
2. Enable regex mode
3. Search for: `\s*console\.log\('\[ChatLayout\].*?\);\n`
4. Replace with: (empty)
5. Repeat for `\[handleNewMessage\]` and `\[Sidebar\]`

### Command Line (PowerShell)
```powershell
# Backup files first
Copy-Item "apps\web\src\components\layout\ChatLayout.tsx" "apps\web\src\components\layout\ChatLayout.tsx.bak"
Copy-Item "apps\web\src\stores\chat.ts" "apps\web\src\stores\chat.ts.bak"
Copy-Item "apps\web\src\components\layout\Sidebar.tsx" "apps\web\src\components\layout\Sidebar.tsx.bak"

# Remove logs (manual edit recommended for safety)
```

## Verification Before Removal

Before removing logs, ensure:
1. ✅ Messages from other users appear in real-time
2. ✅ No console errors
3. ✅ Messages persist after reload
4. ✅ Cross-tab messaging works
5. ✅ No duplicate messages

## After Removal

Test again to ensure:
- App still works correctly
- No errors in console
- Messages still flow properly
