import { memo, useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, CheckCheck, Clock, AlertCircle, Reply, RotateCw, Copy, Edit2, Trash2, X } from 'lucide-react';
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
    const menuRef = useRef<HTMLDivElement>(null);
    const isDeleted = !!message.deletedAt;

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

        const statusToShow = status || 'sent';

        switch (statusToShow) {
            case 'sending':
                return <Clock size={14} className="message-status-icon sending" />;
            case 'sent':
                return <Check size={14} className="message-status-icon" />;
            case 'delivered':
                return <CheckCheck size={14} className="message-status-icon" />;
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
        console.log('[MOBILE-DEBUG] handleDelete called', { messageId: message.id, timestamp: Date.now() });
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        console.log('[Delete] requested for:', message.id);

        if (!window.confirm('Delete this message?')) {
            console.log('[Delete] cancelled by user');
            return;
        }

        try {
            console.log('[Delete] calling API...');
            await api.deleteMessage(message.id);
            console.log('[Delete] API success');
        } catch (err) {
            console.error('[Delete] failed', err);
        }
        setShowMenu(false);
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
                const image = message.attachments[0];
                return image ? (
                    <div className="message-image">
                        <img src={image.thumbnail || image.url} alt="Shared image" loading="lazy" />
                    </div>
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
            className={`message-bubble ${isOwn ? 'own' : 'other'} ${isFailed ? 'failed' : ''} ${isGrouped ? 'grouped' : ''}`}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{ zIndex: showMenu ? 10 : 'auto', position: 'relative', pointerEvents: 'auto' }}
            onContextMenu={(e) => {
                e.preventDefault();
                setShowMenu(true);
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
        >
            {showMenu && (
                <div ref={menuRef} className="message-context-menu" style={{
                    position: 'absolute',
                    top: '100%',
                    [isOwn ? 'right' : 'left']: 0,
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '4px',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    minWidth: '140px',
                    backdropFilter: 'blur(10px)'
                }}>
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
                <div className="message-reply-preview">
                    <Reply size={12} />
                    <span className="truncate">
                        {message.replyTo.content || '[Attachment]'}
                    </span>
                </div>
            )}

            {/* Content */}
            <div className={`message-content ${isDeleted ? 'deleted' : ''}`}>
                {renderContent()}
            </div>

            {/* Footer */}
            <div className="message-footer">
                {message.editedAt && !isDeleted && <span className="message-edited">edited</span>}
                <span className="message-time">{formatTime(message.createdAt)}</span>
                {renderStatus()}
                {isFailed && onRetry && (
                    <button
                        className="message-retry-btn"
                        onClick={onRetry}
                        aria-label="Retry sending message"
                    >
                        <RotateCw size={12} />
                        <span>Retry</span>
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

                // Only render if there are reactions
                if (Object.keys(groupedReactions).length === 0) return null;

                return (
                    <div className="message-reactions">
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
