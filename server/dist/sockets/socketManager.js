"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketManager = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../models/db");
const middlewares_1 = require("../middlewares");
class SocketManager {
    constructor(io) {
        this.typingUsers = new Map();
        this.onlineUsers = new Map();
        this.io = io;
        this.setupNamespaces();
    }
    setupNamespaces() {
        this.chatNamespace = this.io.of('/chat');
        this.chatNamespace.use(this.authenticateSocket.bind(this));
        this.chatNamespace.on('connection', this.handleChatConnection.bind(this));
        this.presenceNamespace = this.io.of('/presence');
        this.presenceNamespace.use(this.authenticateSocket.bind(this));
        this.presenceNamespace.on('connection', this.handlePresenceConnection.bind(this));
    }
    async authenticateSocket(socket, next) {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_ACCESS_SECRET);
            const result = await (0, db_1.query)('SELECT id, username, display_name, avatar_url FROM users WHERE id = $1', [payload.userId]);
            if (result.rows.length === 0) {
                return next(new Error('Authentication error: User not found'));
            }
            socket.userId = payload.userId;
            socket.user = result.rows[0];
            next();
        }
        catch (error) {
            middlewares_1.logger.error('Socket authentication error:', error);
            next(new Error('Authentication error: Invalid token'));
        }
    }
    async handleChatConnection(socket) {
        if (!socket.userId || !socket.user) {
            socket.disconnect();
            return;
        }
        middlewares_1.logger.info(`Chat socket connected: ${socket.user.username} (${socket.id})`);
        socket.join(`user:${socket.userId}`);
        socket.on('join_conversation', async (conversationId) => {
            try {
                const result = await (0, db_1.query)('SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2', [conversationId, socket.userId]);
                if (result.rows.length === 0) {
                    socket.emit('error', { message: 'Not a member of this conversation' });
                    return;
                }
                socket.join(`conversation:${conversationId}`);
                socket.emit('joined_conversation', { conversationId });
                middlewares_1.logger.info(`User ${socket.user?.username} joined conversation ${conversationId}`);
            }
            catch (error) {
                middlewares_1.logger.error('Join conversation error:', error);
                socket.emit('error', { message: 'Failed to join conversation' });
            }
        });
        socket.on('leave_conversation', (conversationId) => {
            socket.leave(`conversation:${conversationId}`);
            socket.emit('left_conversation', { conversationId });
            middlewares_1.logger.info(`User ${socket.user?.username} left conversation ${conversationId}`);
        });
        socket.on('message:new', async (data) => {
            try {
                const { conversationId, text, mediaUrl } = data;
                const memberResult = await (0, db_1.query)('SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2', [conversationId, socket.userId]);
                if (memberResult.rows.length === 0) {
                    socket.emit('error', { message: 'Not a member of this conversation' });
                    return;
                }
                const messageResult = await (0, db_1.query)(`INSERT INTO messages (conversation_id, sender_id, text, media_url)
           VALUES ($1, $2, $3, $4)
           RETURNING *`, [conversationId, socket.userId, text, mediaUrl]);
                const message = messageResult.rows[0];
                message.sender = socket.user;
                this.chatNamespace.to(`conversation:${conversationId}`).emit('message:new', message);
                middlewares_1.logger.info(`New message in conversation ${conversationId} from ${socket.user?.username}`);
            }
            catch (error) {
                middlewares_1.logger.error('New message error:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });
        socket.on('typing:start', (conversationId) => {
            const typingUser = {
                userId: socket.userId,
                username: socket.user.username,
                display_name: socket.user.display_name
            };
            if (!this.typingUsers.has(conversationId)) {
                this.typingUsers.set(conversationId, new Set());
            }
            this.typingUsers.get(conversationId).add(typingUser);
            socket.to(`conversation:${conversationId}`).emit('typing:start', {
                conversationId,
                user: typingUser
            });
        });
        socket.on('typing:stop', (conversationId) => {
            const typingUser = {
                userId: socket.userId,
                username: socket.user.username,
                display_name: socket.user.display_name
            };
            if (this.typingUsers.has(conversationId)) {
                this.typingUsers.get(conversationId).delete(typingUser);
            }
            socket.to(`conversation:${conversationId}`).emit('typing:stop', {
                conversationId,
                user: typingUser
            });
        });
        socket.on('message:read', async (data) => {
            try {
                const { conversationId, messageId } = data;
                await (0, db_1.query)('UPDATE messages SET read_at = NOW() WHERE id = $1 AND conversation_id = $2', [messageId, conversationId]);
                socket.to(`conversation:${conversationId}`).emit('message:read', {
                    messageId,
                    readBy: socket.userId,
                    readAt: new Date()
                });
            }
            catch (error) {
                middlewares_1.logger.error('Message read error:', error);
            }
        });
        socket.on('disconnect', () => {
            middlewares_1.logger.info(`Chat socket disconnected: ${socket.user?.username} (${socket.id})`);
        });
    }
    async handlePresenceConnection(socket) {
        if (!socket.userId || !socket.user) {
            socket.disconnect();
            return;
        }
        middlewares_1.logger.info(`Presence socket connected: ${socket.user.username} (${socket.id})`);
        this.onlineUsers.set(socket.userId, socket.id);
        this.presenceNamespace.emit('presence:update', {
            userId: socket.userId,
            username: socket.user.username,
            display_name: socket.user.display_name,
            status: 'online'
        });
        socket.on('presence:update', (data) => {
            this.presenceNamespace.emit('presence:update', {
                userId: socket.userId,
                username: socket.user.username,
                display_name: socket.user.display_name,
                status: data.status
            });
        });
        socket.on('disconnect', () => {
            this.onlineUsers.delete(socket.userId);
            this.presenceNamespace.emit('presence:update', {
                userId: socket.userId,
                username: socket.user.username,
                display_name: socket.user.display_name,
                status: 'offline'
            });
            middlewares_1.logger.info(`Presence socket disconnected: ${socket.user?.username} (${socket.id})`);
        });
    }
    async sendNotification(userId, notification) {
        this.io.to(`user:${userId}`).emit('notification:new', notification);
    }
    async broadcastToConversation(conversationId, event, data) {
        this.chatNamespace.to(`conversation:${conversationId}`).emit(event, data);
    }
    getOnlineUsers() {
        return Array.from(this.onlineUsers.keys());
    }
    isUserOnline(userId) {
        return this.onlineUsers.has(userId);
    }
}
exports.SocketManager = SocketManager;
//# sourceMappingURL=socketManager.js.map