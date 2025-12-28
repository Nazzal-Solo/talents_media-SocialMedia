import { Server as SocketIOServer } from 'socket.io';
import './middlewares/passport';
import { SocketManager } from './sockets/socketManager';
import { Scheduler } from './services/scheduler';
declare const app: import("express-serve-static-core").Express;
declare const server: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
declare const io: SocketIOServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
declare const socketManager: SocketManager;
declare const scheduler: Scheduler;
export { app, server, io, socketManager, scheduler };
//# sourceMappingURL=server.d.ts.map