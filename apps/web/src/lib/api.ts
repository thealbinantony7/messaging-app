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

        if (this.accessToken && !options?.skipAuth) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
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

    // ... (rest of methods)

    // Upload
    async uploadImage(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        return this.request<{ url: string }>('POST', '/upload/image', formData, { isFormData: true });
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
