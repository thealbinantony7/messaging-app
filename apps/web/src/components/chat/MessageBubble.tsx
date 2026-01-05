import { memo, useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, CheckCheck, Clock, AlertCircle, Reply, Copy, Edit2, Trash2, X, MoreHorizontal } from 'lucide-react';
import type { MessageWithDetails, MessageStatus } from '@linkup/shared';
import { formatTime } from '../../lib/utils';
import { api } from '../../lib/api';
import { useChatStore } from '../../stores/chat';
import { useAuthStore } from '../../stores/auth';
import './MessageBubble.css';

interface Props {
    message: MessageWithDetails;
    isOwn: boolean;
    status?: MessageStatus | 'sending';
    onRetry?: () => void;
    isGrouped?: boolean;
}

export const MessageBubble = memo(function MessageBubble({ message, isOwn, status, onRetry, isGrouped = false }: Props) {
    const [showMenu, setShowMenu] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content || '');
    const [showLightbox, setShowLightbox] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const isDeleted = !!message.deletedAt;

    // Reaction handling
    const toggleReaction = useChatStore((state) => state.toggleReaction);
    const QUICK_EMOJIS = ['👍', '❤️', '😂'];

    // PHASE 6.5: Get conversation for channel type checking
    const conversation = useChatStore((state) =>
        state.conversations.find(c => c.id === message.conversationId)
    );

    // Close menu when clicking outside
    useEffect(() => {
        if (!showMenu) return;
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showMenu]);

    const renderStatus = () => {
        if (!isOwn) return null;

        // PHASE 9.8: CRITICAL FIX - Respect passed status prop for groups
        // The status prop contains aggregated group read state from ChatView
        // For groups, message.readAt doesn't exist - we MUST use the passed status
        let statusToShow: MessageStatus | 'sending' = 'sent';

        if (status) {
            // Use passed status (includes pending messages AND group aggregation)
            statusToShow = status;
        } else {
            // Fallback: derive from backend fields (DMs only, or if no status passed)
            if (conversation?.type === 'channel') {
                statusToShow = 'sent';
            } else if (message.readAt) {
                statusToShow = 'read';
            } else if (message.deliveredAt) {
                statusToShow = 'delivered';
            } else {
                statusToShow = 'sent';
            }
        }

        switch (statusToShow) {
            case 'sending':
                return <Clock size={14} className="message-status-icon sending" />;
            case 'sent':
                return <Check size={14} className="message-status-icon sent" />;
            case 'delivered':
                return <CheckCheck size={14} className="message-status-icon delivered" />;
            case 'read':
                return <CheckCheck size={14} className="message-status-icon read" />;
            case 'failed':
                return <AlertCircle size={14} className="message-status-icon failed" />;
            default:
                return null;
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content || '');
        setShowMenu(false);
    };

    const handleDelete = async (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!window.confirm('Delete this message?')) return;

        // Optimistic: mark as deleted immediately
        useChatStore.getState().updateMessage(
            message.conversationId,
            message.id,
            { deletedAt: new Date().toISOString() }
        );
        setShowMenu(false);

        // Background: confirm with server
        try {
            await api.deleteMessage(message.id);
        } catch (err) {
            console.error('[Delete] failed', err);
            // Revert on failure
            useChatStore.getState().updateMessage(
                message.conversationId,
                message.id,
                { deletedAt: null }
            );
        }
    };

    const handleEdit = async () => {
        if (!editContent.trim() || editContent === message.content) {
            setIsEditing(false);
            return;
        }
        try {
            await api.editMessage(message.id, editContent);
            setIsEditing(false);
        } catch (e) {
            console.error('Failed to edit message', e);
        }
    };

    const canEdit = isOwn && !isDeleted && message.type === 'text' &&
        (Date.now() - new Date(message.createdAt).getTime() < 5 * 60 * 1000);

    const renderContent = () => {
        if (isDeleted) {
            return <span className="message-deleted">This message was deleted</span>;
        }

        if (isEditing) {
            return (
                <div className="message-edit-input">
                    <input
                        autoFocus
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEdit();
                            if (e.key === 'Escape') {
                                setIsEditing(false);
                                setEditContent(message.content || '');
                            }
                        }}
                    />
                    <div className="message-edit-actions">
                        <button onClick={handleEdit}><Check size={14} /></button>
                        <button onClick={() => { setIsEditing(false); setEditContent(message.content || ''); }}><X size={14} /></button>
                    </div>
                </div>
            );
        }

        switch (message.type) {
            case 'text':
                return <p className="message-text">{message.content}</p>;
            case 'image':
                // Image URL can be in attachments[0].url OR directly in message.content
                const imageUrl = message.attachments[0]?.url || message.attachments[0]?.thumbnail || message.content;
                return imageUrl ? (
                    <>
                        <div
                            className="message-image"
                            onClick={() => setShowLightbox(true)}
                            style={{ cursor: 'pointer' }}
                        >
                            <img src={imageUrl} alt="Shared image" loading="lazy" />
                        </div>
                        {showLightbox && (
                            <div
                                onClick={() => setShowLightbox(false)}
                                style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: 'rgba(0,0,0,0.9)',
                                    zIndex: 9999,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '20px'
                                }}
                            >
                                <img
                                    src={imageUrl}
                                    alt="Full size"
                                    onClick={(e) => e.stopPropagation()}
                                    onContextMenu={(e) => e.stopPropagation()}
                                    style={{
                                        maxWidth: '90%',
                                        maxHeight: '90%',
                                        objectFit: 'contain',
                                        borderRadius: '8px'
                                    }}
                                />
                            </div>
                        )}
                    </>
                ) : null;
            case 'video':
                const video = message.attachments[0];
                return video ? (
                    <div className="message-video">
                        <video src={video.url} poster={video.thumbnail || undefined} controls />
                    </div>
                ) : null;
            case 'voice':
                const voice = message.attachments[0];
                return voice ? (
                    <div className="message-voice">
                        <audio src={voice.url} controls />
                        {message.content && (
                            <p className="message-transcript">{message.content}</p>
                        )}
                    </div>
                ) : null;
            case 'system':
                return <span className="message-system">{message.content}</span>;
            default:
                return <p className="message-text">{message.content}</p>;
        }
    };

    // System messages have different styling
    if (message.type === 'system') {
        return (
            <div className="message-system-wrapper">
                <span className="message-system">{message.content}</span>
            </div>
        );
    }

    const isFailed = status === 'failed';

    // Long press logic for mobile
    const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startPos = useRef<{ x: number, y: number } | null>(null);
    const isLongPress = useRef(false);

    // Cleanup touch timer on unmount
    useEffect(() => {
        return () => {
            if (touchTimer.current) {
                clearTimeout(touchTimer.current);
                touchTimer.current = null;
            }
        };
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
        console.log('[MOBILE-DEBUG] touchstart', { timestamp: Date.now(), touches: e.touches.length, x: e.touches[0]?.clientX, y: e.touches[0]?.clientY });
        if (e.touches.length === 0) return;
        isLongPress.current = false;
        startPos.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };

        touchTimer.current = setTimeout(() => {
            console.log('[MOBILE-DEBUG] long-press triggered, opening menu');
            isLongPress.current = true;
            setShowMenu(true);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
    };

    const handleTouchEnd = () => {
        console.log('[MOBILE-DEBUG] touchend', { hadTimer: !!touchTimer.current });
        if (touchTimer.current) {
            clearTimeout(touchTimer.current);
            touchTimer.current = null;
        }
        startPos.current = null;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!startPos.current || !touchTimer.current || e.touches.length === 0) return;

        const moveX = Math.abs(e.touches[0]!.clientX - startPos.current.x);
        const moveY = Math.abs(e.touches[0]!.clientY - startPos.current.y);

        // Cancel if moved more than 10px
        if (moveX > 10 || moveY > 10) {
            console.log('[MOBILE-DEBUG] touchmove cancelled long-press', { moveX, moveY });
            clearTimeout(touchTimer.current);
            touchTimer.current = null;
        }
    };

    return (
        <motion.div
            className={`message-bubble group relative w-fit max-w-[75%] md:max-w-[65%] px-4 py-2.5 shadow-none ${isOwn ? 'ml-auto bg-primary text-primary-foreground rounded-[1.25rem] rounded-tr-sm' : 'bg-secondary text-secondary-foreground rounded-[1.25rem] rounded-tl-sm'} ${isFailed ? 'opacity-50' : ''} ${isGrouped ? 'mt-0.5' : 'mt-4'}`}
            // Removed animated transitions for a flat, instant feel
            layout={false}
            style={{ zIndex: showMenu ? 10 : 'auto', position: 'relative', pointerEvents: 'auto' }}
            onContextMenu={(e) => {
                e.preventDefault();
                setShowMenu(true);
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
        >
            {/* PHASE 9.9: Desktop Action Menu Trigger - moved to TOP-RIGHT to avoid tick collision */}
            <button
                className={`absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground' : 'bg-black/5 hover:bg-black/10 text-foreground'} md:block hidden`}
                onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(true);
                }}
                aria-label="Message options"
            >
                <MoreHorizontal size={14} />
            </button>

            {showMenu && (
                <div ref={menuRef} className="message-context-menu" style={{
                    position: 'absolute',
                    top: '100%',
                    left: isOwn ? 'auto' : '0',
                    right: isOwn ? '0' : 'auto',
                    marginTop: '4px',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '4px',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    minWidth: '140px',
                    backdropFilter: 'blur(10px)'
                }}>
                    {/* Reaction emoji bar */}
                    {!isDeleted && (
                        <div className="context-menu-reactions">
                            {QUICK_EMOJIS.map(emoji => (
                                <button
                                    key={emoji}
                                    className="context-menu-reaction-btn"
                                    onClick={() => {
                                        toggleReaction(message.id, emoji);
                                        setShowMenu(false);
                                    }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}

                    <button onClick={handleCopy} className="menu-item" style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        width: '100%', padding: '12px', background: 'transparent',
                        border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px',
                        textAlign: 'left', minHeight: '44px'
                    }}>
                        <Copy size={16} /> Copy
                    </button>
                    {canEdit && (
                        <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="menu-item" style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            width: '100%', padding: '12px', background: 'transparent',
                            border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px',
                            textAlign: 'left', minHeight: '44px'
                        }}>
                            <Edit2 size={16} /> Edit
                        </button>
                    )}
                    {isOwn && !isDeleted && (
                        <button
                            onClick={handleDelete}
                            onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDelete();
                            }}
                            className="menu-item"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                width: '100%', padding: '12px', background: 'transparent',
                                border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '14px',
                                textAlign: 'left', minHeight: '44px'
                            }}
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                    )}
                </div>
            )}

            {/* Reply preview */}
            {message.replyTo && (
                <div className="message-reply-preview !bg-black/10 !rounded-lg !mb-2">
                    <Reply size={12} />
                    <span className="truncate">
                        {message.replyTo.content || '[Attachment]'}
                    </span>
                </div>
            )}

            {/* Content */}
            <div className={`message-content ${isDeleted ? 'italic opacity-60' : ''} text-[15px] leading-relaxed break-words`}>
                {renderContent()}
            </div>

            {/* PHASE 9.9: Footer with z-index protection to ensure ticks always visible */}
            <div className={`flex items-center justify-end gap-1 mt-1 text-[11px] ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} style={{ position: 'relative', zIndex: 2 }}>
                {message.editedAt && !isDeleted && <span>edited</span>}
                <span>{formatTime(message.createdAt)}</span>
                {renderStatus()}
                {isFailed && onRetry && (
                    <button
                        className="ml-1 hover:underline"
                        onClick={onRetry}
                        aria-label="Retry sending message"
                    >
                        Retry
                    </button>
                )}
            </div>

            {/* Reactions */}
            {(() => {
                const reactions = useChatStore((state) => state.reactions[message.id] || []);
                const toggleReaction = useChatStore((state) => state.toggleReaction);
                const { user } = useAuthStore();

                // Group reactions by emoji
                const groupedReactions = reactions.reduce((acc, r) => {
                    if (!acc[r.emoji]) acc[r.emoji] = [];
                    acc[r.emoji]!.push(r);
                    return acc;
                }, {} as Record<string, typeof reactions>);

                const hasReactions = Object.keys(groupedReactions).length > 0;

                if (!hasReactions) return null;

                return (
                    <div className="message-reactions !mt-2">
                        {Object.entries(groupedReactions).map(([emoji, reacts]) => {
                            const hasReacted = user && reacts.some(r => r.userId === user.id);
                            return (
                                <button
                                    key={emoji}
                                    className={`reaction-pill ${hasReacted ? 'reacted' : ''}`}
                                    onClick={() => toggleReaction(message.id, emoji)}
                                >
                                    <span className="reaction-emoji">{emoji}</span>
                                    <span className="reaction-count">{reacts.length}</span>
                                </button>
                            );
                        })}
                    </div>
                );
            })()}
        </motion.div>
    );
});
