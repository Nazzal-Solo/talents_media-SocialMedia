# Talents Media

A production-ready social media platform with a stunning dark neon theme, built with Node.js/Express backend and Next.js frontend.

![Talents Media](https://via.placeholder.com/800x400/0b0a1f/7c5cfc?text=Talents+Media)

## ✨ Features

- 🌙 **Dark Neon Theme** - Multiple theme presets with glassmorphism effects
- 🔐 **Authentication** - JWT with Google OAuth and password reset
- 💬 **Real-time Chat** - Socket.IO powered messaging with typing indicators
- 📱 **Responsive Design** - Mobile-first with modern UI components
- 🎥 **Video Reels** - Cloudinary-powered video sharing
- 📊 **Admin Dashboard** - Analytics and user management
- 🌍 **Geolocation** - Location-based features and analytics
- 📧 **Email Notifications** - EmailJS integration for notifications
- 🔒 **Security** - Rate limiting, CORS, helmet, and input validation
- 📚 **API Documentation** - Swagger/OpenAPI documentation
- 🧪 **Testing** - Jest test suite for critical routes

## 🚀 Tech Stack

### Backend

- **Node.js** + **Express** + **TypeScript**
- **PostgreSQL** (Neon) with connection pooling
- **JWT Authentication** with refresh token rotation
- **Socket.IO** for real-time features
- **Cloudinary** for media storage
- **EmailJS** for email services
- **Passport.js** for Google OAuth
- **Pino** for structured logging
- **Swagger** for API documentation

### Frontend

- **Next.js 14** (App Router)
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** + **Radix UI** for components
- **TanStack Query** for server state
- **Zustand** for client state
- **Socket.IO Client** for real-time features
- **Framer Motion** for animations
- **React Hook Form** + **Zod** for forms

## 🏗️ Project Structure

```
/
├── server/                 # Node.js/Express backend
│   ├── src/
│   │   ├── controllers/    # Route controllers
│   │   ├── services/       # Business logic
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── middlewares/    # Express middleware
│   │   ├── sockets/        # Socket.IO handlers
│   │   ├── utils/          # Utility functions
│   │   └── tests/          # Test files
│   ├── migrations/         # Database migrations
│   └── seeds/              # Database seeds
└── web/                    # Next.js frontend
    ├── app/                # App Router pages
    ├── components/         # React components
    ├── lib/                # Utility libraries
    ├── store/              # Zustand stores
    └── styles/             # Global styles
```

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL database (Neon recommended)
- Google OAuth credentials
- EmailJS account
- Cloudinary account
- NewsAPI key

### 1. Clone and Install

```bash
git clone <repository-url>
cd social-media-platform
npm install
```

### 2. Database Setup

1. **Create a Neon PostgreSQL database:**
   - Go to [Neon Console](https://console.neon.tech/)
   - Create a new project
   - Copy the connection string

2. **Run migrations:**

   ```bash
   npm run migrate
   ```

3. **Seed with sample data:**
   ```bash
   npm run seed
   ```

### 3. Environment Configuration

#### Backend (.env)

```bash
# Copy the example file
cp server/env.example server/.env
```

```env
# Database
DATABASE_URL=postgres://USER:PASS@HOST:PORT/DB?sslmode=require

# JWT Secrets (generate strong secrets)
JWT_ACCESS_SECRET=your-super-secret-access-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production

# Server Configuration
COOKIE_DOMAIN=.localhost
WEB_URL=http://localhost:3000
PORT=4000

# EmailJS Configuration
EMAILJS_SERVICE_ID=your-service-id
EMAILJS_TEMPLATE_ID_RESET=your-template-id
EMAILJS_PUBLIC_KEY=your-public-key
EMAILJS_PRIVATE_KEY=your-private-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Cloudinary
CLOUDINARY_URL=cloudinary://KEY:SECRET@CLOUD

# News API
NEWSAPI_KEY=your-newsapi-key

# Environment
NODE_ENV=development
```

#### Frontend (.env.local)

```bash
# Copy the example file
cp web/env.local.example web/.env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### 4. Start Development Servers

```bash
# Start both backend and frontend
npm run dev

# Or start individually
npm run dev:server  # Backend on :4000
npm run dev:web     # Frontend on :3000
```

## 🌐 Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000/api
- **API Documentation**: http://localhost:4000/api/docs
- **Health Check**: http://localhost:4000/health

## 🎨 Theme System

The platform features a sophisticated theme system with multiple presets:

- **Dark Neon** (default) - Purple gradients with neon accents
- **Light** - Clean light theme
- **Cyber Cyan** - Cyan-based dark theme
- **Magenta** - Pink/magenta accents
- **Violet** - Purple-focused theme

### Theme Features

- Glassmorphism effects with backdrop blur
- Neon glow animations
- Gradient text effects
- Smooth transitions
- System preference detection

## 🔐 Authentication

### Features

- **JWT Authentication** with access/refresh tokens
- **Google OAuth** integration
- **Password Reset** via EmailJS
- **Session Management** with rotation
- **Role-based Access** (user/admin)

### Security

- Rate limiting on auth endpoints
- Secure httpOnly cookies
- Password hashing with bcrypt
- Input validation with Zod
- CORS and helmet protection

## 📡 API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `GET /api/auth/google` - Google OAuth
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset

### Posts

- `GET /api/posts/feed` - Get user feed
- `POST /api/posts` - Create post
- `GET /api/posts/:id` - Get post
- `PATCH /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

### Users

- `GET /api/users/me` - Get current user
- `PATCH /api/users/me` - Update profile
- `GET /api/users/:username` - Get user profile
- `POST /api/users/:username/follow` - Follow user
- `DELETE /api/users/:username/follow` - Unfollow user

### Comments & Reactions

- `GET /api/comments/post/:postId` - Get post comments
- `POST /api/comments/post/:postId` - Create comment
- `DELETE /api/comments/:id` - Delete comment
- `POST /api/reactions/post/:postId` - Add reaction
- `DELETE /api/reactions/post/:postId` - Remove reaction

### Reels

- `GET /api/reels` - Get reels feed
- `POST /api/reels` - Create reel
- `GET /api/reels/:id` - Get reel
- `PATCH /api/reels/:id` - Update reel
- `DELETE /api/reels/:id` - Delete reel
- `POST /api/reels/:id/view` - Record view

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test -- --coverage
```

## 📚 Scripts

### Root Level

- `npm run dev` - Start both servers
- `npm run build` - Build both applications
- `npm run test` - Run backend tests
- `npm run lint` - Lint both applications
- `npm run format` - Format code
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database

### Backend (server/)

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code

### Frontend (web/)

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Lint code
- `npm run format` - Format code

## 🚀 Deployment

### Backend Deployment

1. Set `NODE_ENV=production`
2. Update database URL for production
3. Set secure JWT secrets
4. Configure CORS for production domain
5. Deploy to your preferred platform (Railway, Render, etc.)

### Frontend Deployment

1. Update `NEXT_PUBLIC_API_URL` for production
2. Build the application: `npm run build`
3. Deploy to Vercel, Netlify, or your preferred platform

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing React framework
- [Tailwind CSS](https://tailwindcss.com/) for utility-first CSS
- [shadcn/ui](https://ui.shadcn.com/) for beautiful components
- [Socket.IO](https://socket.io/) for real-time features
- [Neon](https://neon.tech/) for PostgreSQL hosting
- [Cloudinary](https://cloudinary.com/) for media management

## 📞 Support

If you have any questions or need help, please:

- Open an issue on GitHub
- Check the API documentation at `/api/docs`
- Review the test files for usage examples

---

Built with ❤️ using modern web technologies
