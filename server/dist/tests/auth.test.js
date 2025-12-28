"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const server_1 = require("../server");
const db_1 = require("../models/db");
describe('Auth Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const userData = {
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
                displayName: 'Test User',
            };
            db_1.query.mockResolvedValueOnce({
                rows: [],
            }).mockResolvedValueOnce({
                rows: [{
                        id: 'user-123',
                        email: userData.email,
                        username: userData.username,
                        display_name: userData.displayName,
                        theme_pref: 'dark-neon',
                        role: 'user',
                        created_at: new Date(),
                        updated_at: new Date(),
                    }],
            }).mockResolvedValueOnce({
                rows: [],
            });
            const response = await (0, supertest_1.default)(server_1.app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('accessToken');
            expect(response.body.user.email).toBe(userData.email);
            expect(response.body.user.username).toBe(userData.username);
        });
        it('should return error for invalid email', async () => {
            const userData = {
                email: 'invalid-email',
                username: 'testuser',
                password: 'password123',
                displayName: 'Test User',
            };
            const response = await (0, supertest_1.default)(server_1.app)
                .post('/api/auth/register')
                .send(userData)
                .expect(400);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toBe('Validation failed');
        });
        it('should return error for existing email', async () => {
            const userData = {
                email: 'existing@example.com',
                username: 'testuser',
                password: 'password123',
                displayName: 'Test User',
            };
            db_1.query.mockResolvedValueOnce({
                rows: [{ id: 'existing-user' }],
            });
            const response = await (0, supertest_1.default)(server_1.app)
                .post('/api/auth/register')
                .send(userData)
                .expect(400);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('already exists');
        });
    });
    describe('POST /api/auth/login', () => {
        it('should login user successfully', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'password123',
            };
            db_1.query.mockResolvedValueOnce({
                rows: [{
                        id: 'user-123',
                        email: loginData.email,
                        username: 'testuser',
                        display_name: 'Test User',
                        password_hash: '$2a$12$hashedpassword',
                        theme_pref: 'dark-neon',
                        role: 'user',
                        created_at: new Date(),
                        updated_at: new Date(),
                    }],
            }).mockResolvedValueOnce({
                rows: [],
            });
            const response = await (0, supertest_1.default)(server_1.app)
                .post('/api/auth/login')
                .send(loginData)
                .expect(200);
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('accessToken');
            expect(response.body.user.email).toBe(loginData.email);
        });
        it('should return error for invalid credentials', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'wrongpassword',
            };
            db_1.query.mockResolvedValueOnce({
                rows: [],
            });
            const response = await (0, supertest_1.default)(server_1.app)
                .post('/api/auth/login')
                .send(loginData)
                .expect(401);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toBe('Invalid credentials');
        });
    });
    describe('GET /api/auth/me', () => {
        it('should return user data for authenticated user', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                username: 'testuser',
                display_name: 'Test User',
                theme_pref: 'dark-neon',
                role: 'user',
                created_at: new Date(),
                updated_at: new Date(),
            };
            const token = 'valid-jwt-token';
            db_1.query.mockResolvedValueOnce({
                rows: [mockUser],
            });
            const response = await (0, supertest_1.default)(server_1.app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe(mockUser.email);
        });
        it('should return error for unauthenticated request', async () => {
            const response = await (0, supertest_1.default)(server_1.app)
                .get('/api/auth/me')
                .expect(401);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toBe('Access token required');
        });
    });
});
//# sourceMappingURL=auth.test.js.map