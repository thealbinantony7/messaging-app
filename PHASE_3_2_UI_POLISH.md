# Phase 3.2: UI Polish (Visual Refinement)

## Visual Principles Applied
1.  **Calm & Confident:** Reduced visual noise by using softer grays (`zinc-800`, `zinc-500`) and removing harsh borders. The interface feels more "quiet" and professional.
2.  **Modern Roundness:** Updated border radii to `rounded-2xl` for message bubbles and inputs, and `rounded-xl` for list items, matching modern mobile OS aesthetics (iOS/Android).
3.  **Depth via Translucency:** Applied `backdrop-blur` and semi-transparent backgrounds (`bg-black/40`, `white/5`) to headers and inputs to create a sense of depth and context preservation.
4.  **Subtle Interaction:** used `hover:bg-white/5` and micro-scale animations (`scale: 1.01`) to provide tactile feedback without being distracting.
5.  **Hierarchical Typography:** Adjusted font sizes and weights (`font-medium` for names, `text-[15px]` for messages) to clear distinct data at a glance.

## Changes Overview (Logic Touched: NONE)

### 1. Message Bubble (`MessageBubble.tsx`)
*   **Radii:** `rounded-2xl` with specific corner tweaks (`rounded-tr-sm` / `rounded-tl-sm`) for message flow.
*   **Colors:** Own messages `bg-blue-600`, others `bg-zinc-800`.
*   **Shadows:** Added subtle `shadow-sm` for depth.
*   **Text:** `text-[15px]` `leading-relaxed` for better readability.

### 2. Conversation List (`ConversationItem.tsx`)
*   **Spacing:** Increased padding `py-3` and margin `mx-2` for a breathable list.
*   **Hover:** Softer `hover:bg-white/5` and `scale: 1.01`.
*   **Badges:** Unread badge is now `bg-blue-600` with a soft glow `shadow-blue-900/20`.

### 3. Chat View (`ChatView.tsx`)
*   **Header:** Fixed `h-[72px]`, added `backdrop-blur-md` and `border-b border-white/5`.
*   **Input:** `backdrop-blur-xl`, `border-t border-white/5`. Input field is `bg-zinc-800/40`.
*   **Send Button:** Fully round `rounded-full` with `shadow-md`.

## ✅ Safety Check
*   **Logic:** No functional code was modified.
*   **State:** No new state variables or stores accessed.
*   **Realtime:** WebSocket and Scroll behaviors remain exactly as they were in Phase 3.1.
