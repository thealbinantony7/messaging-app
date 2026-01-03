# Phase 6.3: Manual Verification Checklist

> **Instructions**: Run these tests in order. Check each box after successful completion.

## Setup
- [ ] Start PostgreSQL database
- [ ] Start Redis server
- [ ] Run database migrations: `psql -d lucent -f apps/server/src/db/schema.sql`
- [ ] Start dev server: `npm run dev`
- [ ] Create two test accounts (User A and User B)

---

## Test 1: Basic Read Receipt Flow

**Goal**: Verify read receipts work end-to-end

- [ ] Open two browser windows (User A and User B)
- [ ] User A sends message to User B
- [ ] User B opens conversation
- [ ] **Verify**: User A sees blue double-check (✓✓) within 1 second
- [ ] **Verify in DB**:
  ```sql
  SELECT id, delivered_at, read_at, created_at 
  FROM messages 
  WHERE id = '<message_id>';
  ```
  - [ ] Both `delivered_at` and `read_at` exist
  - [ ] `read_at >= delivered_at`

---

## Test 2: Reload Persistence

**Goal**: Ensure read state survives page refresh

- [ ] User A sends message
- [ ] User B opens conversation (marks as read)
- [ ] User B refreshes page (F5)
- [ ] **Verify**: Message still shows as read (blue ticks on User A's side)
- [ ] **Verify**: No downgrade to delivered state

---

## Test 3: Mobile Behavior

**Goal**: Ensure mobile behaves identically to desktop

- [ ] Open DevTools → Device Toolbar → Select "iPhone 14"
- [ ] User A sends message
- [ ] User B opens conversation on "mobile"
- [ ] **Verify**: Blue ticks appear (same as desktop)
- [ ] **Verify**: No timing differences

---

## Test 4: Reconnect Stability

**Goal**: Ensure read state persists through network disruptions

- [ ] User A sends message
- [ ] User B opens conversation (marks as read)
- [ ] User B: DevTools → Network → Check "Offline"
- [ ] Wait 5 seconds
- [ ] User B: Uncheck "Offline"
- [ ] **Verify**: Message still shows as read
- [ ] **Verify**: No state regression or duplicate broadcasts

---

## Test 5: Database Constraint Enforcement

**Goal**: Verify database prevents invalid states

- [ ] Attempt to set `read_at` without `delivered_at`:
  ```sql
  UPDATE messages 
  SET read_at = NOW() 
  WHERE id = '<message_id>' AND delivered_at IS NULL;
  ```
- [ ] **Verify**: Database returns constraint violation error
- [ ] **Verify**: Error mentions `chk_read_requires_delivered`

---

## Test 6: Idempotency

**Goal**: Ensure repeated mark_read calls are safe

- [ ] User B opens conversation (triggers mark_read)
- [ ] User B closes conversation
- [ ] User B reopens conversation
- [ ] Repeat 2 more times (total 3 reopens)
- [ ] **Verify**: No errors in browser console
- [ ] **Verify**: Server logs show `msg.read.noop` for subsequent calls

---

## Test 7: Channel Messages (No Read Receipts)

**Goal**: Verify channels don't show read receipts

- [ ] Create a channel conversation
- [ ] Admin sends message
- [ ] Member opens conversation
- [ ] **Verify**: Status stays 'sent' (no blue ticks)
- [ ] **Verify**: No `delivered_at` or `read_at` in database

---

## Test 8: Cross-Device Consistency

**Goal**: Ensure read state syncs across devices

- [ ] User A sends message
- [ ] User B opens conversation on Device 1 (desktop browser)
- [ ] User B opens same conversation on Device 2 (different browser/tab)
- [ ] **Verify**: Both devices show message as read
- [ ] **Verify**: Read state appears on both within 1 second

---

## Final Checks

- [ ] No console errors in browser
- [ ] No errors in server logs
- [ ] All 8 tests passed
- [ ] Database constraints are active (verify with `\d messages` in psql)

---

## Sign-off

**Tested by**: _______________  
**Date**: _______________  
**Result**: ☐ PASS  ☐ FAIL

**Notes**:
