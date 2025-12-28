import { Server as SocketIOServer } from 'socket.io';
export declare class SocketManager {
    private io;
    private chatNamespace;
    private presenceNamespace;
    private typingUsers;
    private onlineUsers;
    constructor(io: SocketIOServer);
    private setupNamespaces;
    private authenticateSocket;
    private handleChatConnection;
    private handlePresenceConnection;
    sendNotification(userId: string, notification: any): Promise<void>;
    broadcastToConversation(conversationId: string, event: string, data: any): Promise<void>;
    getOnlineUsers(): string[];
    isUserOnline(userId: string): boolean;
}
//# sourceMappingURL=socketManager.d.ts.map