import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Social Media Platform API',
      version: '1.0.0',
      description: 'A modern social media platform API with dark neon theme',
      contact: {
        name: 'API Support',
        email: 'support@socialplatform.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.WEB_URL || 'http://localhost:4000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email',
            },
            username: {
              type: 'string',
              description: 'Username',
            },
            display_name: {
              type: 'string',
              description: 'Display name',
            },
            avatar_url: {
              type: 'string',
              format: 'uri',
              description: 'Avatar URL',
            },
            bio: {
              type: 'string',
              description: 'User bio',
            },
            website: {
              type: 'string',
              format: 'uri',
              description: 'Website URL',
            },
            location: {
              type: 'string',
              description: 'User location',
            },
            theme_pref: {
              type: 'string',
              enum: ['dark-neon', 'light', 'cyan', 'magenta', 'violet'],
              description: 'Theme preference',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              description: 'User role',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        Post: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Post ID',
            },
            user_id: {
              type: 'string',
              format: 'uuid',
              description: 'User ID',
            },
            text: {
              type: 'string',
              description: 'Post text content',
            },
            media_url: {
              type: 'string',
              format: 'uri',
              description: 'Media URL',
            },
            media_type: {
              type: 'string',
              enum: ['image', 'video', 'none'],
              description: 'Media type',
            },
            visibility: {
              type: 'string',
              enum: ['public', 'followers', 'private'],
              description: 'Post visibility',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
            reactions: {
              type: 'object',
              properties: {
                like: { type: 'integer' },
                love: { type: 'integer' },
                laugh: { type: 'integer' },
                wow: { type: 'integer' },
                sad: { type: 'integer' },
                angry: { type: 'integer' },
              },
            },
            comments_count: {
              type: 'integer',
              description: 'Number of comments',
            },
            user_reaction: {
              type: 'string',
              enum: ['like', 'love', 'laugh', 'wow', 'sad', 'angry'],
              description: 'Current user reaction',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
              description: 'Validation error details',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #7c5cfc; }
      .swagger-ui .scheme-container { background: #0b0a1f; }
      .swagger-ui .btn.authorize { background-color: #7c5cfc; border-color: #7c5cfc; }
      .swagger-ui .btn.authorize:hover { background-color: #6d3ef7; border-color: #6d3ef7; }
    `,
    customSiteTitle: 'Social Media Platform API',
    customfavIcon: '/favicon.ico',
  }));

  // Serve OpenAPI JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
}
