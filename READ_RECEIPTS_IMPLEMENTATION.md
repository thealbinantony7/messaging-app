# Read Receipts (Delivery Only) Implementation

## Overview
Implemented basic delivery receipts for direct messages and group chats. Shows single check (sent) or double check (delivered) for outgoing messages only.

## Changes Made

### 1. Shared Types (`packages/shared/src/index.ts`)
- Added `delivery_receipt` to `ServerMessage` union type
- Reuses existing `ReadReceiptPayload` interface for delivery receipts

### 2. Chat Store (`apps/web/src/stores/chat.ts`)
- **New State**:
  ```typescript
  deliveryReceipts: Record<string, Set<string>>; // messageId -> Set of userIds
  ```
- **New Actions**:
  - `setDeliveryReceipt(messageId, userId)`: Adds user to delivery set
  - `handleDeliveryReceipt(payload)`: WebSocket event handler

### 3. ChatLayout (`apps/web/src/components/layout/ChatLayout.tsx`)
- Added `delivery_receipt` case to WebSocket message handler
- Calls `handleDeliveryReceipt` when delivery receipt is received

### 4. ChatView (`apps/web/src/components/chat/ChatView.tsx`)
- Added `deliveryReceipts` selector
- **New Function**: `getMessageStatus(messageId)`
  - Returns `'sent'` for channels (no receipts)
  - Returns `'delivered'` if any other member has received the message
  - Returns `'sent'` otherwise
- Passes computed status to `MessageBubble` for own messages only

### 5. MessageBubble (`apps/web/src/components/chat/MessageBubble.tsx`)
- Updated `status` prop type to accept `MessageStatus | 'sending'`
- Existing `renderStatus()` already handles:
  - `sending`: Clock icon
  - `sent`: Single check ✓
  - `delivered`: Double check ✓✓
  - `read`: Double check ✓✓ (blue/colored)
  - `failed`: Alert icon

## UI Behavior

### For Outgoing Messages (DMs & Groups):
- **Sending**: Clock icon (⏱)
- **Sent**: Single check (✓)
- **Delivered**: Double check (✓✓) - shown when at least one recipient has received it

### For Channels:
- Always shows "sent" status (single check)
- No delivery receipts tracked

### For Incoming Messages:
- No status icons shown

## Styling
- Icons are subtle: 14px size, low opacity
- Positioned in message footer next to timestamp
- Existing CSS already handles all states

## WebSocket Flow

1. **User A sends message** → Message stored with status `'sending'`
2. **Server acknowledges** → Status updated to `'sent'` (single check)
3. **User B receives message** → Server emits `delivery_receipt` event
4. **User A's client** → Receives delivery receipt, updates `deliveryReceipts` state
5. **UI updates** → Single check changes to double check

## Backend Requirements

The backend needs to:
1. Emit `delivery_receipt` events when a message is delivered to a recipient
2. Use the `ReadReceiptPayload` format:
   ```typescript
   {
     type: 'delivery_receipt',
     payload: {
       conversationId: string,
       userId: string,  // recipient who received it
       messageId: string
     }
   }
   ```

## Testing

To test delivery receipts:
1. Open two browser windows (Alice and Bob)
2. Alice sends a message to Bob
3. Alice should see single check initially
4. When Bob's client receives the message, server should emit delivery receipt
5. Alice's UI should update to double check

## Not Implemented (as per requirements)
- ❌ Read timestamps
- ❌ Animations
- ❌ Per-user delivery states in groups
- ❌ Receipts for channels
- ❌ "Read" receipts (only delivery)
