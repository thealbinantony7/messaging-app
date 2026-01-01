// ============================================================================
// LINKUP Shared Types
// Core type definitions shared between frontend and backend
// ============================================================================

// ----------------------------------------------------------------------------
// Base Types
// ----------------------------------------------------------------------------

export type UUID = string;
export type ISODateString = string;

// ----------------------------------------------------------------------------
// User Types
// ----------------------------------------------------------------------------

export interface User {
    id: UUID;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    status: string | null;
    lastSeenAt: ISODateString | null;
    isOnline?: boolean;  // PHASE 6.2: Backend-computed (NOW() - last_seen_at < 30s)
    createdAt: ISODateString;
}

export interface UserPresence {
    userId: UUID;
    status: 'online' | 'offline';
    lastSeenAt: ISODateString | null;
}

// ----------------------------------------------------------------------------
// Conversation Types
// ----------------------------------------------------------------------------

export type ConversationType = 'dm' | 'group' | 'channel';
export type MemberRole = 'admin' | 'member';

export interface Conversation {
    id: UUID;
    type: ConversationType;
    name: string | null;
    avatarUrl: string | null;
    createdAt: ISODateString;
    updatedAt: ISODateString;
}

export interface ConversationMember {
    id: UUID;
    conversationId: UUID;
    userId: UUID;
    role: MemberRole;
    lastReadMessageId: UUID | null;
    mutedUntil: ISODateString | null;
    joinedAt: ISODateString;
}

export interface ConversationWithMembers extends Conversation {
    members: (ConversationMember & { user: User })[];
    lastMessage: Message | null;
    unreadCount: number;
}

// ----------------------------------------------------------------------------
// Message Types
// ----------------------------------------------------------------------------

export type MessageType = 'text' | 'image' | 'video' | 'voice' | 'system';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
    id: UUID;
    conversationId: UUID;
    senderId: UUID;
    content: string | null;
    type: MessageType;
    replyToId: UUID | null;
    editedAt: ISODateString | null;
    deletedAt: ISODateString | null;
    deliveredAt: ISODateString | null;  // PHASE 6: Backend-authoritative delivery timestamp
    readAt: ISODateString | null;        // PHASE 6: Backend-authoritative read timestamp
    createdAt: ISODateString;
}

export interface MessageWithDetails extends Message {
    sender: User;
    replyTo: Message | null;
    attachments: Attachment[];
    reactions: Reaction[];
}

// ----------------------------------------------------------------------------
// Attachment Types
// ----------------------------------------------------------------------------

export type AttachmentType = 'image' | 'video' | 'voice';

export interface Attachment {
    id: UUID;
    messageId: UUID;
    type: AttachmentType;
    url: string;
    mimeType: string;
    sizeBytes: number;
    durationMs: number | null;
    thumbnail: string | null;
    width: number | null;
    height: number | null;
    createdAt: ISODateString;
}

// ----------------------------------------------------------------------------
// Reaction Types
// ----------------------------------------------------------------------------

export interface Reaction {
    id: UUID;
    messageId: UUID;
    userId: UUID;
    emoji: string;
    createdAt: ISODateString;
}

// ----------------------------------------------------------------------------
// WebSocket Protocol Types
// ----------------------------------------------------------------------------

// Client → Server Messages
export type ClientMessage =
    | { type: 'send_message'; payload: SendMessagePayload }
    | { type: 'edit_message'; payload: EditMessagePayload }
    | { type: 'delete_message'; payload: DeleteMessagePayload }
    | { type: 'typing'; payload: TypingPayload }
    | { type: 'read'; payload: ReadPayload }
    | { type: 'react'; payload: ReactPayload }
    | { type: 'subscribe'; payload: SubscribePayload }
    | { type: 'unsubscribe'; payload: UnsubscribePayload }
    | { type: 'ping' };

export interface SendMessagePayload {
    id: UUID;
    conversationId: UUID;
    content: string | null;
    type: MessageType;
    replyToId?: UUID;
    attachmentIds?: UUID[];
}

export interface EditMessagePayload {
    id: UUID;
    content: string;
}

export interface DeleteMessagePayload {
    id: UUID;
}

export interface TypingPayload {
    conversationId: UUID;
    isTyping: boolean;
}

export interface ReadPayload {
    conversationId: UUID;
    messageId: UUID;
}

export interface ReactPayload {
    messageId: UUID;
    emoji: string | null; // null to remove reaction
}

export interface SubscribePayload {
    conversationIds: UUID[];
}

export interface UnsubscribePayload {
    conversationIds: UUID[];
}

// Server → Client Messages
export type ServerMessage =
    | { type: 'message_ack'; payload: MessageAckPayload }
    | { type: 'new_message'; payload: MessageWithDetails }
    | { type: 'message_updated'; payload: MessageUpdatedPayload }
    | { type: 'message_deleted'; payload: MessageDeletedPayload }
    | { type: 'typing'; payload: TypingIndicatorPayload }
    | { type: 'delivery_receipt'; payload: ReadReceiptPayload }
    | { type: 'read_receipt'; payload: ReadReceiptPayload }
    | { type: 'presence'; payload: UserPresence }
    | { type: 'reaction_updated'; payload: ReactionUpdatedPayload }
    | { type: 'error'; payload: ErrorPayload }
    | { type: 'pong' };

export interface MessageAckPayload {
    id: UUID;
    status: 'ok' | 'error';
    timestamp?: ISODateString;
    error?: string;
}

export interface MessageUpdatedPayload {
    id: UUID;
    conversationId: UUID;
    content: string;
    editedAt: ISODateString;
}

export interface MessageDeletedPayload {
    id: UUID;
    conversationId: UUID;
}

export interface TypingIndicatorPayload {
    conversationId: UUID;
    userId: UUID;
    isTyping: boolean;
}

export interface ReadReceiptPayload {
    conversationId: UUID;
    userId?: UUID;
    messageId: UUID;
    deliveredAt?: ISODateString;  // PHASE 6: Backend-authoritative delivery timestamp
    readAt?: ISODateString;        // PHASE 6: Backend-authoritative read timestamp
}

export interface ReactionUpdatedPayload {
    messageId: UUID;
    conversationId: UUID;
    userId: UUID;
    emoji: string | null;
}

export interface ErrorPayload {
    code: string;
    message: string;
}

// ----------------------------------------------------------------------------
// API Request/Response Types
// ----------------------------------------------------------------------------

// Auth
export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    displayName: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: User;
}

// Conversations
export interface CreateConversationRequest {
    type: ConversationType;
    emails: string[]; // List of emails to invite
    name?: string;    // Only for groups
}

export interface CreateDmRequest {
    userId?: UUID;
    email?: string;
}

export interface CreateGroupRequest {
    name: string;
    memberIds?: UUID[];
    emails?: string[];
}

export interface UpdateGroupRequest {
    name?: string;
    avatarUrl?: string;
}

export interface CreateInviteLinkRequest {
    conversationId: UUID;
}

export interface CreateInviteLinkResponse {
    token: string;
    inviteUrl: string;
}

export interface JoinViaInviteRequest {
    token: string;
}

export interface JoinViaInviteResponse {
    conversationId: UUID;
    conversation: ConversationWithMembers;
}

export interface AddMembersRequest {
    memberIds: UUID[];
}

export interface RemoveMemberRequest {
    memberId: UUID;
}

// Messages
export interface GetMessagesParams {
    conversationId: UUID;
    before?: UUID;
    limit?: number;
}

export interface GetMessagesResponse {
    messages: MessageWithDetails[];
    hasMore: boolean;
}

// AI
export interface RewriteRequest {
    text: string;
    style: 'shorter' | 'clearer' | 'formal' | 'casual';
}

export interface RewriteResponse {
    rewritten: string;
}

export interface SuggestRepliesRequest {
    conversationId: UUID;
    lastMessageCount?: number;
}

export interface SuggestRepliesResponse {
    suggestions: string[];
}

export interface SummarizeRequest {
    conversationId: UUID;
    sinceMessageId?: UUID;
}

export interface SummarizeResponse {
    summary: string;
    messageCount: number;
}

export interface TranscribeRequest {
    attachmentId: UUID;
}

export interface TranscribeResponse {
    transcript: string;
}

// Upload
export interface GetUploadUrlRequest {
    filename: string;
    mimeType: string;
    sizeBytes: number;
}

export interface GetUploadUrlResponse {
    uploadUrl: string;
    attachmentId: UUID;
    expiresAt: ISODateString;
}

// ----------------------------------------------------------------------------
// Utility Types
// ----------------------------------------------------------------------------

export interface PaginatedResponse<T> {
    data: T[];
    hasMore: boolean;
    cursor?: string;
}

export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
