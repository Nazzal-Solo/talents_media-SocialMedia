import request from 'supertest';
import { app } from '../server';
import { query } from '../models/db';

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

      // Mock database query
      (query as jest.Mock).mockResolvedValueOnce({
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

      const response = await request(app)
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

      const response = await request(app)
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

      // Mock existing user
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'existing-user' }],
      });

      const response = await request(app)
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

      // Mock user lookup and password verification
      (query as jest.Mock).mockResolvedValueOnce({
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

      const response = await request(app)
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

      // Mock user not found
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app)
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

      // Mock authenticated request
      const token = 'valid-jwt-token';
      
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [mockUser],
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(mockUser.email);
    });

    it('should return error for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Access token required');
    });
  });
});
