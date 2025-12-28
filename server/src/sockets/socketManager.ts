import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query } from '../models/db';
import { logger } from '../middlewares';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    username: string;
    display_name: string;
  };
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  text?: string;
  media_url?: string;
  created_at: Date;
  sender?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface TypingUser {
  userId: string;
  username: string;
  display_name: string;
}

export class SocketManager {
  private io: SocketIOServer;
  private chatNamespace: any;
  private presenceNamespace: any;
  private typingUsers: Map<string, Set<TypingUser>> = new Map();
  private onlineUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupNamespaces();
  }

  private setupNamespaces(): void {
    // Chat namespace
    this.chatNamespace = this.io.of('/chat');
    this.chatNamespace.use(this.authenticateSocket.bind(this));
    this.chatNamespace.on('connection', this.handleChatConnection.bind(this));

    // Presence namespace
    this.presenceNamespace = this.io.of('/presence');
    this.presenceNamespace.use(this.authenticateSocket.bind(this));
    this.presenceNamespace.on('connection', this.handlePresenceConnection.bind(this));
  }

  private async authenticateSocket(socket: AuthenticatedSocket, next: Function): Promise<void> {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;
      
      // Verify user exists
      const result = await query(
        'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
        [payload.userId]
      );

      if (result.rows.length === 0) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = payload.userId;
      socket.user = result.rows[0];
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  }

  private async handleChatConnection(socket: AuthenticatedSocket): Promise<void> {
    if (!socket.userId || !socket.user) {
      socket.disconnect();
      return;
    }

    logger.info(`Chat socket connected: ${socket.user.username} (${socket.id})`);

    // Join user to their personal room
    socket.join(`user:${socket.userId}`);

    // Handle joining conversations
    socket.on('join_conversation', async (conversationId: string) => {
      try {
        // Verify user is member of conversation
        const result = await query(
          'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, socket.userId]
        );

        if (result.rows.length === 0) {
          socket.emit('error', { message: 'Not a member of this conversation' });
          return;
        }

        socket.join(`conversation:${conversationId}`);
        socket.emit('joined_conversation', { conversationId });
        
        logger.info(`User ${socket.user?.username} joined conversation ${conversationId}`);
      } catch (error) {
        logger.error('Join conversation error:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    // Handle leaving conversations
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      socket.emit('left_conversation', { conversationId });
      logger.info(`User ${socket.user?.username} left conversation ${conversationId}`);
    });

    // Handle new messages
    socket.on('message:new', async (data: { conversationId: string; text?: string; mediaUrl?: string }) => {
      try {
        const { conversationId, text, mediaUrl } = data;

        // Verify user is member of conversation
        const memberResult = await query(
          'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, socket.userId]
        );

        if (memberResult.rows.length === 0) {
          socket.emit('error', { message: 'Not a member of this conversation' });
          return;
        }

        // Create message
        const messageResult = await query(
          `INSERT INTO messages (conversation_id, sender_id, text, media_url)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [conversationId, socket.userId, text, mediaUrl]
        );

        const message = messageResult.rows[0] as ChatMessage;
        message.sender = socket.user;

        // Broadcast to conversation
        this.chatNamespace.to(`conversation:${conversationId}`).emit('message:new', message);
        
        logger.info(`New message in conversation ${conversationId} from ${socket.user?.username}`);
      } catch (error) {
        logger.error('New message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing:start', (conversationId: string) => {
      const typingUser: TypingUser = {
        userId: socket.userId!,
        username: socket.user!.username,
        display_name: socket.user!.display_name
      };

      if (!this.typingUsers.has(conversationId)) {
        this.typingUsers.set(conversationId, new Set());
      }

      this.typingUsers.get(conversationId)!.add(typingUser);
      
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        conversationId,
        user: typingUser
      });
    });

    socket.on('typing:stop', (conversationId: string) => {
      const typingUser: TypingUser = {
        userId: socket.userId!,
        username: socket.user!.username,
        display_name: socket.user!.display_name
      };

      if (this.typingUsers.has(conversationId)) {
        this.typingUsers.get(conversationId)!.delete(typingUser);
      }

      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        conversationId,
        user: typingUser
      });
    });

    // Handle message read receipts
    socket.on('message:read', async (data: { conversationId: string; messageId: string }) => {
      try {
        const { conversationId, messageId } = data;

        // Update message read_at
        await query(
          'UPDATE messages SET read_at = NOW() WHERE id = $1 AND conversation_id = $2',
          [messageId, conversationId]
        );

        // Broadcast read receipt
        socket.to(`conversation:${conversationId}`).emit('message:read', {
          messageId,
          readBy: socket.userId,
          readAt: new Date()
        });
      } catch (error) {
        logger.error('Message read error:', error);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Chat socket disconnected: ${socket.user?.username} (${socket.id})`);
    });
  }

  private async handlePresenceConnection(socket: AuthenticatedSocket): Promise<void> {
    if (!socket.userId || !socket.user) {
      socket.disconnect();
      return;
    }

    logger.info(`Presence socket connected: ${socket.user.username} (${socket.id})`);

    // Add user to online users
    this.onlineUsers.set(socket.userId, socket.id);

    // Broadcast user online status
    this.presenceNamespace.emit('presence:update', {
      userId: socket.userId,
      username: socket.user.username,
      display_name: socket.user.display_name,
      status: 'online'
    });

    // Handle status updates
    socket.on('presence:update', (data: { status: 'online' | 'away' | 'busy' }) => {
      this.presenceNamespace.emit('presence:update', {
        userId: socket.userId,
        username: socket.user!.username,
        display_name: socket.user!.display_name,
        status: data.status
      });
    });

    socket.on('disconnect', () => {
      // Remove user from online users
      this.onlineUsers.delete(socket.userId!);

      // Broadcast user offline status
      this.presenceNamespace.emit('presence:update', {
        userId: socket.userId,
        username: socket.user!.username,
        display_name: socket.user!.display_name,
        status: 'offline'
      });

      logger.info(`Presence socket disconnected: ${socket.user?.username} (${socket.id})`);
    });
  }

  // Public methods for external use
  public async sendNotification(userId: string, notification: any): Promise<void> {
    this.io.to(`user:${userId}`).emit('notification:new', notification);
  }

  public async broadcastToConversation(conversationId: string, event: string, data: any): Promise<void> {
    this.chatNamespace.to(`conversation:${conversationId}`).emit(event, data);
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.onlineUsers.keys());
  }

  public isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }
}
