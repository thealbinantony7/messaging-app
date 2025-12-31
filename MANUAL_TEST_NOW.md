# MANUAL TEST - Message Rendering Debug

## Quick Test (Do this NOW)

### Window 1 - Alice
1. Open http://localhost:5173
2. Open DevTools Console (F12)
3. Login: `alice@example.com` / `password123`
4. Click Bob's conversation
5. **Watch console carefully**

### Window 2 - Bob  
1. Open http://localhost:5173 in a NEW WINDOW (not tab)
2. Open DevTools Console (F12)
3. Login: `bob@example.com` / `password123`
4. Click Alice's conversation
5. Type: "Debug test 123"
6. Send

### Back to Window 1 - Alice
**Look at console logs. You should see:**

```
[ChatLayout] WebSocket message received: new_message
[handleNewMessage] Received message: {conversationId: "xxx", conversationIdType: "string", ...}
[handleNewMessage] ADDED message. New count: X
[ChatView] Selector called for conversation xxx - found X messages
[ChatView] Component rendering - conversationId: xxx, messages: X
```

## What to Report

1. **Did you see the selector being called?**
   - Look for: `[ChatView] Selector called`
   - If YES: The selector is reactive
   - If NO: The selector is NOT being triggered

2. **Did the component re-render?**
   - Look for: `[ChatView] Component rendering`
   - Count should increase after message arrives

3. **Is the message visible in the UI?**
   - Look in Alice's chat window
   - Should see "Debug test 123" on the left side

4. **Copy ALL console logs** from Alice's window after Bob sends the message

## If Selector is NOT Called

This means Zustand isn't detecting the state change. Possible causes:
- State update isn't creating new reference
- Selector equality check is wrong
- Store subscription isn't working

## If Selector IS Called but UI doesn't update

This means:
- Component is re-rendering
- But the messages aren't being displayed
- Check if `conversationMessages.map()` is running

## If Message appears in Sidebar but not ChatView

This confirms:
- WebSocket is working
- Store is updating
- But ChatView selector has an issue
