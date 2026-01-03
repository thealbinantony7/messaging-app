const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiClient {
    private accessToken: string | null = null;

    setAccessToken(token: string | null) {
        this.accessToken = token;
    }

    private async request<T>(
        method: string,
        path: string,
        body?: unknown,
        options?: { skipAuth?: boolean; isFormData?: boolean }
    ): Promise<T> {
        // Headers - don't set Content-Type for FormData (browser sets boundary)
        const headers: Record<string, string> = options?.isFormData ? {} : {
            'Content-Type': 'application/json',
        };

        // CRITICAL FIX: Always read token from localStorage to avoid race conditions
        // This ensures retry and reload scenarios work correctly
        if (!options?.skipAuth) {
            let token = this.accessToken;

            // Fallback to localStorage if in-memory token is not set (handles rehydration race)
            if (!token) {
                try {
                    const stored = localStorage.getItem('linkup-auth');
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        token = parsed.state?.accessToken || null;
                    }
                } catch (err) {
                    console.error('Failed to read token from localStorage:', err);
                }
            }

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        const response = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            body: options?.isFormData ? (body as FormData) : (body ? JSON.stringify(body) : undefined),
        });

        if (!response.ok) {
            const error = (await response.json().catch(() => ({}))) as any;
            const message = error.details || error.error || error.message || `Request failed: ${response.status}`;
            throw new Error(message);
        }

        return response.json();
    }

    // Auth
    async login(request: import('@linkup/shared').LoginRequest) {
        const result = await this.request<{
            accessToken: string;
            refreshToken: string;
            user: import('@linkup/shared').User;
        }>('POST', '/auth/login', request, { skipAuth: true });

        this.accessToken = result.accessToken;
        return result;
    }

    async register(request: import('@linkup/shared').RegisterRequest) {
        const result = await this.request<{
            accessToken: string;
            refreshToken: string;
            user: import('@linkup/shared').User;
        }>('POST', '/auth/register', request, { skipAuth: true });

        this.accessToken = result.accessToken;
        return result;
    }

    async refresh(refreshToken: string) {
        const result = await this.request<{
            accessToken: string;
            refreshToken: string;
            user: import('@linkup/shared').User;
        }>('POST', '/auth/refresh', { refreshToken }, { skipAuth: true });

        this.accessToken = result.accessToken;
        return result;
    }

    async logout(refreshToken: string) {
        await this.request<{ success: boolean }>('POST', '/auth/logout', { refreshToken });
        this.accessToken = null;
    }

    async getMe() {
        return this.request<{ user: import('@linkup/shared').User }>('GET', '/auth/me');
    }

    async updateProfile(data: { displayName?: string; status?: string }) {
        return this.request<{ user: import('@linkup/shared').User }>('PATCH', '/auth/me', data);
    }

    // Conversations
    async getConversations() {
        return this.request<{
            conversations: import('@linkup/shared').ConversationWithMembers[];
        }>('GET', '/conversations');
    }

    async getConversation(id: string) {
        return this.request<{
            conversation: import('@linkup/shared').ConversationWithMembers;
        }>('GET', `/conversations/${id}`);
    }

    async createConversation(request: import('@linkup/shared').CreateConversationRequest) {
        return this.request<{ conversationId: string }>('POST', '/conversations', request);
    }

    async createDm(userId: string) {
        return this.request<{ conversationId: string }>('POST', '/conversations', {
            type: 'dm',
            emails: [],
            userId
        });
    }

    async createGroup(name: string, emails: string[]) {
        return this.request<{ conversationId: string }>('POST', '/conversations', {
            type: 'group',
            name,
            emails,
        });
    }

    // Messages
    async getMessages(conversationId: string, before?: string, limit = 50) {
        const params = new URLSearchParams({ conversationId, limit: limit.toString() });
        if (before) params.set('before', before);
        return this.request<import('@linkup/shared').GetMessagesResponse>(
            'GET',
            `/messages?${params}`
        );
    }

    async editMessage(id: string, content: string) {
        return this.request<{ success: boolean; editedAt: string }>('PATCH', `/messages/${id}`, { content });
    }

    async deleteMessage(id: string) {
        return this.request<{ success: boolean }>('DELETE', `/messages/${id}`);
    }

    // PHASE 7.2: Message search
    async searchMessages(conversationId: string, query: string) {
        const params = new URLSearchParams({ conversationId, q: query });
        return this.request<{
            results: Array<{
                id: string;
                content: string;
                type: string;
                createdAt: string;
                senderId: string;
                senderName: string;
            }>
        }>('GET', `/messages/search?${params}`);
    }

    // AI
    async rewrite(text: string, style: 'shorter' | 'clearer' | 'formal' | 'casual') {
        return this.request<import('@linkup/shared').RewriteResponse>('POST', '/ai/rewrite', {
            text,
            style,
        });
    }

    async getSuggestions(conversationId: string) {
        return this.request<import('@linkup/shared').SuggestRepliesResponse>('POST', '/ai/suggestions', {
            conversationId,
        });
    }

    async summarize(conversationId: string, sinceMessageId?: string) {
        return this.request<import('@linkup/shared').SummarizeResponse>('POST', '/ai/summarize', {
            conversationId,
            sinceMessageId,
        });
    }

    async transcribe(attachmentId: string) {
        return this.request<import('@linkup/shared').TranscribeResponse>('POST', '/ai/transcribe', {
            attachmentId,
        });
    }

    async getAiStatus() {
        return this.request<{
            available: boolean;
            features: Record<string, boolean>;
        }>('GET', '/ai/status');
    }

    // Upload
    async uploadImage(file: File, onProgress?: (percent: number) => void): Promise<{ url: string }> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append('file', file);

            // Track upload progress
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch (err) {
                        reject(new Error('Invalid response from server'));
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('Network error'));

            xhr.open('POST', `${API_BASE}/upload/image`);
            if (this.accessToken) {
                xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);
            }
            xhr.send(formData);
        });
    }

    async getUploadUrl(filename: string, mimeType: string, sizeBytes: number) {
        return this.request<import('@linkup/shared').GetUploadUrlResponse>('POST', '/upload/url', {
            filename,
            mimeType,
            sizeBytes,
        });
    }

    async confirmUpload(attachmentId: string) {
        return this.request<{ success: boolean }>('POST', `/upload/${attachmentId}/complete`);
    }

    // Invite Links
    async createInviteLink(conversationId: string) {
        return this.request<import('@linkup/shared').CreateInviteLinkResponse>('POST', '/invite/create', {
            conversationId,
        });
    }

    async joinViaInvite(token: string) {
        return this.request<import('@linkup/shared').JoinViaInviteResponse>('POST', '/invite/join', {
            token,
        });
    }

    async getInviteLink(conversationId: string) {
        return this.request<import('@linkup/shared').CreateInviteLinkResponse>('GET', `/invite/${conversationId}`);
    }
}

export const api = new ApiClient();
