import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUIStore } from '../../stores/ui';
import { useChatStore } from '../../stores/chat';
import { useAuthStore } from '../../stores/auth';
import { wsClient } from '../../lib/ws';
import { Sidebar } from './Sidebar';
import { ChatView } from '../chat/ChatView';
import { EmptyState } from '../chat/EmptyState';
import { NewChatModal } from '../chat/NewChatModal';
import './ChatLayout.css';

export function ChatLayout() {
    const { sidebarOpen, activeConversationId, isMobile, setIsMobile, activeModal } = useUIStore();
    const { user } = useAuthStore();

    // Track mobile breakpoint
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [setIsMobile]);

    // Setup WebSocket listeners - use store directly to avoid stale closures
    useEffect(() => {
        if (!user) return;

        const unsubscribe = wsClient.onMessage((msg) => {
            // Get handlers directly from store to avoid stale closures
            const { handleMessageAck, handleNewMessage } = useChatStore.getState();

            switch (msg.type) {
                case 'message_ack':
                    handleMessageAck(msg.payload);
                    break;
                case 'new_message':
                    handleNewMessage(msg.payload);
                    break;
                case 'typing':
                    useChatStore.getState().setTypingUser(
                        msg.payload.conversationId,
                        msg.payload.userId,
                        msg.payload.isTyping
                    );
                    break;
                case 'delivery_receipt':
                    useChatStore.getState().handleDeliveryReceipt(msg.payload);
                    break;
                case 'read_receipt':
                    useChatStore.getState().handleReadReceipt(msg.payload);
                    break;
                case 'message_updated':
                    useChatStore.getState().handleMessageUpdated(msg.payload);
                    break;
                case 'message_deleted':
                    useChatStore.getState().handleMessageDeleted(msg.payload);
                    break;
                case 'reaction_updated':
                    useChatStore.getState().handleReactionUpdated(msg.payload);
                    break;
                // Add other handlers here
            }
        });

        return unsubscribe;
    }, [user]); // Only depend on user, not the handler functions

    // On mobile, show either sidebar or chat, not both
    const showSidebar = isMobile ? !activeConversationId : sidebarOpen;
    const showChat = isMobile ? !!activeConversationId : true;

    return (
        <div className="chat-layout">
            {/* Sidebar */}
            <motion.aside
                className="chat-sidebar"
                initial={false}
                animate={{
                    width: showSidebar ? 'var(--sidebar-width)' : 0,
                    opacity: showSidebar ? 1 : 0,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                {showSidebar && <Sidebar />}
            </motion.aside>

            {/* Main chat area */}
            {showChat && (
                <main className="chat-main">
                    {activeConversationId ? (
                        <ChatView conversationId={activeConversationId} />
                    ) : (
                        <EmptyState />
                    )}
                </main>
            )}

            {/* Modals */}
            {activeModal === 'new-chat' && <NewChatModal />}
        </div>
    );
}
