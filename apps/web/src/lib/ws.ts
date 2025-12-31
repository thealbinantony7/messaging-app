import type { ClientMessage, ServerMessage } from '@linkup/shared';

type MessageHandler = (message: ServerMessage) => void;

class WebSocketClient {
    private ws: WebSocket | null = null;
    private token: string | null = null;
    private handlers = new Set<MessageHandler>();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 1000;
    private pingInterval: ReturnType<typeof setInterval> | null = null;
    private messageQueue: ClientMessage[] = [];

    connect(token: string) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return;
        }

        this.token = token;
        let envWsUrl = import.meta.env.VITE_WS_URL;
        if (envWsUrl) {
            envWsUrl = envWsUrl.replace(/^http/, 'ws');
        }

        const wsUrl = envWsUrl
            ? `${envWsUrl}/ws?token=${encodeURIComponent(token)}`
            : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

        try {
            this.ws = new WebSocket(wsUrl);
            this.setupEventHandlers();
        } catch (err) {
            console.error('WebSocket connection failed:', err);
            this.scheduleReconnect();
        }
    }

    private setupEventHandlers() {
        if (!this.ws) return;

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.startPing();
            this.flushQueue();
        };

        this.ws.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            this.stopPing();
            if (event.code !== 4001) {
                // Don't reconnect if explicitly unauthorized
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data) as ServerMessage;
                this.handlers.forEach((handler) => handler(message));
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err);
            }
        };
    }

    private scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnect attempts reached');
            return;
        }

        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
            30000
        );

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

        setTimeout(() => {
            this.reconnectAttempts++;
            if (this.token) {
                this.connect(this.token);
            }
        }, delay);
    }

    private startPing() {
        this.pingInterval = setInterval(() => {
            this.send({ type: 'ping' });
        }, 30000);
    }

    private stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    private flushQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift()!;
            this.send(message);
        }
    }

    disconnect() {
        this.stopPing();
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        this.token = null;
    }

    send(message: ClientMessage) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            // Queue message for when connection is restored
            if (message.type !== 'ping') {
                this.messageQueue.push(message);
            }
        }
    }

    onMessage(handler: MessageHandler) {
        this.handlers.add(handler);
        return () => {
            this.handlers.delete(handler);
        };
    }

    // Convenience methods
    subscribe(conversationIds: string[]) {
        this.send({ type: 'subscribe', payload: { conversationIds } });
    }

    unsubscribe(conversationIds: string[]) {
        this.send({ type: 'unsubscribe', payload: { conversationIds } });
    }

    sendMessage(
        id: string,
        conversationId: string,
        content: string | null,
        type: 'text' | 'image' | 'video' | 'voice' = 'text',
        replyToId?: string,
        attachmentIds?: string[]
    ) {
        this.send({
            type: 'send_message',
            payload: { id, conversationId, content, type, replyToId, attachmentIds },
        });
    }

    editMessage(id: string, content: string) {
        this.send({ type: 'edit_message', payload: { id, content } });
    }

    deleteMessage(id: string) {
        this.send({ type: 'delete_message', payload: { id } });
    }

    setTyping(conversationId: string, isTyping: boolean) {
        this.send({ type: 'typing', payload: { conversationId, isTyping } });
    }

    markRead(conversationId: string, messageId: string) {
        this.send({ type: 'read', payload: { conversationId, messageId } });
    }

    react(messageId: string, emoji: string | null) {
        this.send({ type: 'react', payload: { messageId, emoji } });
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

export const wsClient = new WebSocketClient();
