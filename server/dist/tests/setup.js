"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const testPool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});
jest.mock('../models/db', () => ({
    query: jest.fn(),
    pool: testPool,
}));
beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await testPool.query('DELETE FROM admin_audit_logs');
    await testPool.query('DELETE FROM password_resets');
    await testPool.query('DELETE FROM oauth_accounts');
    await testPool.query('DELETE FROM views');
    await testPool.query('DELETE FROM ads');
    await testPool.query('DELETE FROM news_items');
    await testPool.query('DELETE FROM notifications');
    await testPool.query('DELETE FROM messages');
    await testPool.query('DELETE FROM conversation_members');
    await testPool.query('DELETE FROM conversations');
    await testPool.query('DELETE FROM reactions');
    await testPool.query('DELETE FROM comments');
    await testPool.query('DELETE FROM reels');
    await testPool.query('DELETE FROM follows');
    await testPool.query('DELETE FROM posts');
    await testPool.query('DELETE FROM sessions');
    await testPool.query('DELETE FROM users');
});
afterAll(async () => {
    await testPool.query('DELETE FROM admin_audit_logs');
    await testPool.query('DELETE FROM password_resets');
    await testPool.query('DELETE FROM oauth_accounts');
    await testPool.query('DELETE FROM views');
    await testPool.query('DELETE FROM ads');
    await testPool.query('DELETE FROM news_items');
    await testPool.query('DELETE FROM notifications');
    await testPool.query('DELETE FROM messages');
    await testPool.query('DELETE FROM conversation_members');
    await testPool.query('DELETE FROM conversations');
    await testPool.query('DELETE FROM reactions');
    await testPool.query('DELETE FROM comments');
    await testPool.query('DELETE FROM reels');
    await testPool.query('DELETE FROM follows');
    await testPool.query('DELETE FROM posts');
    await testPool.query('DELETE FROM sessions');
    await testPool.query('DELETE FROM users');
    await testPool.end();
});
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
//# sourceMappingURL=setup.js.map