// PHASE 8.1: Draft persistence using localStorage
// Drafts are NOT messages - they're local-only UI state

const DRAFT_KEY_PREFIX = 'lucent_draft_';

export const draftStorage = {
    // Save draft for a conversation
    saveDraft(conversationId: string, content: string) {
        if (!content.trim()) {
            // Clear draft if empty
            this.clearDraft(conversationId);
            return;
        }

        try {
            localStorage.setItem(`${DRAFT_KEY_PREFIX}${conversationId}`, content);
        } catch (err) {
            console.warn('[Draft] Failed to save:', err);
        }
    },

    // Load draft for a conversation
    loadDraft(conversationId: string): string {
        try {
            return localStorage.getItem(`${DRAFT_KEY_PREFIX}${conversationId}`) || '';
        } catch (err) {
            console.warn('[Draft] Failed to load:', err);
            return '';
        }
    },

    // Clear draft (called on successful send)
    clearDraft(conversationId: string) {
        try {
            localStorage.removeItem(`${DRAFT_KEY_PREFIX}${conversationId}`);
        } catch (err) {
            console.warn('[Draft] Failed to clear:', err);
        }
    },

    // Clear all drafts (optional cleanup)
    clearAllDrafts() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(DRAFT_KEY_PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (err) {
            console.warn('[Draft] Failed to clear all:', err);
        }
    }
};
