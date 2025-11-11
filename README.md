# Chat Backend API

Express backend with Supabase authentication, Drizzle ORM, and Socket.IO for real-time chat functionality.

## Features

- Email/Password authentication with Supabase
- Real-time chat with Socket.IO
- PostgreSQL database with Drizzle ORM
- RESTful API endpoints
- TypeScript support
- User online status tracking
- Message read receipts
- Typing indicators
- Group chat support

## Tech Stack

- **Express.js** - Web framework
- **Supabase** - Authentication and database hosting
- **Drizzle ORM** - Type-safe database queries
- **Socket.IO** - Real-time bidirectional communication
- **TypeScript** - Type safety
- **PostgreSQL** - Database

## Project Structure

```
be_chat_app/
├── src/
│   ├── db/
│   │   └── schema.ts          # Database schema definitions
│   ├── lib/
│   │   ├── auth.ts            # Authentication middleware
│   │   ├── db.ts              # Database connection
│   │   ├── socket.ts          # Socket.IO server setup
│   │   └── supabase.ts        # Supabase client
│   ├── middleware/
│   │   └── error.ts           # Error handling middleware
│   ├── routes/
│   │   ├── auth.routes.ts     # Authentication routes
│   │   └── chat.routes.ts     # Chat routes
│   └── index.ts               # Main server file
├── drizzle.config.ts          # Drizzle configuration
├── tsconfig.json              # TypeScript configuration
├── .env.example               # Environment variables template
└── package.json               # Dependencies and scripts
```

## Setup Instructions

### 1. Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database (or use Supabase)
- Supabase account

### 2. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Get your project URL and keys from Settings > API

### 3. Environment Variables

Create a `.env` file in the `be_chat_app` directory:

```bash
cp .env.example .env
```

Fill in the following variables:

```env
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Database Configuration (from Supabase)
DATABASE_URL=postgresql://postgres:[password]@[host]:[port]/[database]

# JWT Secret
JWT_SECRET=your_jwt_secret_key

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:8080
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Database Setup

Push the schema to your database:

```bash
npm run db:push
```

Or generate and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

### 6. Run the Server

Development mode (with hot reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## API Endpoints

### Authentication

#### POST /api/auth/signup
Register a new user
```json
{
  "email": "user@example.com",
  "password": "password123",
  "username": "optional_username"
}
```

#### POST /api/auth/login
Login with credentials
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### POST /api/auth/logout
Logout (requires authentication)

#### GET /api/auth/me
Get current user information (requires authentication)

#### POST /api/auth/refresh
Refresh access token
```json
{
  "refresh_token": "your_refresh_token"
}
```

### Chat

All chat endpoints require authentication via Bearer token in the Authorization header.

#### GET /api/chat/conversations
Get all conversations for the current user

#### POST /api/chat/conversations
Create a new conversation
```json
{
  "participantIds": ["user_id_1", "user_id_2"],
  "name": "Optional group name",
  "isGroup": false
}
```

#### GET /api/chat/conversations/:conversationId/messages
Get messages for a conversation
Query params: `limit` (default: 50), `offset` (default: 0)

#### POST /api/chat/conversations/:conversationId/messages
Send a message
```json
{
  "content": "Hello, world!"
}
```

#### PUT /api/chat/messages/:messageId
Edit a message
```json
{
  "content": "Updated message content"
}
```

#### DELETE /api/chat/messages/:messageId
Delete a message

#### POST /api/chat/conversations/:conversationId/read
Mark conversation as read

### Health Check

#### GET /health
Check server status

## Socket.IO Events

### Client to Server

#### connection
Connect to the Socket.IO server with authentication
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your_jwt_token' }
});
```

#### conversation:join
Join a conversation room
```javascript
socket.emit('conversation:join', conversationId);
```

#### conversation:leave
Leave a conversation room
```javascript
socket.emit('conversation:leave', conversationId);
```

#### message:send
Send a message
```javascript
socket.emit('message:send', {
  conversationId: 'conversation_id',
  content: 'Message content'
});
```

#### typing:start
Indicate user is typing
```javascript
socket.emit('typing:start', {
  conversationId: 'conversation_id'
});
```

#### typing:stop
Indicate user stopped typing
```javascript
socket.emit('typing:stop', {
  conversationId: 'conversation_id'
});
```

#### message:status
Update message status
```javascript
socket.emit('message:status', {
  messageId: 'message_id',
  status: 'delivered' // or 'read'
});
```

### Server to Client

#### conversation:joined
Confirmation of joining a conversation
```javascript
socket.on('conversation:joined', (data) => {
  console.log('Joined conversation:', data.conversationId);
});
```

#### message:new
New message received
```javascript
socket.on('message:new', (message) => {
  console.log('New message:', message);
});
```

#### typing:update
Typing status update
```javascript
socket.on('typing:update', (data) => {
  console.log('User typing:', data);
});
```

#### message:status:update
Message status updated
```javascript
socket.on('message:status:update', (data) => {
  console.log('Message status:', data);
});
```

#### user:online
User came online
```javascript
socket.on('user:online', (data) => {
  console.log('User online:', data.userId);
});
```

#### user:offline
User went offline
```javascript
socket.on('user:offline', (data) => {
  console.log('User offline:', data.userId);
});
```

#### error
Error occurred
```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

## Database Schema

### users
- id (uuid, primary key)
- email (text, unique)
- username (text)
- avatarUrl (text)
- isOnline (boolean)
- lastSeen (timestamp)
- createdAt (timestamp)
- updatedAt (timestamp)

### conversations
- id (uuid, primary key)
- name (text, optional)
- isGroup (boolean)
- createdAt (timestamp)
- updatedAt (timestamp)

### conversation_participants
- id (uuid, primary key)
- conversationId (uuid, foreign key)
- userId (uuid, foreign key)
- joinedAt (timestamp)
- lastReadAt (timestamp)

### messages
- id (uuid, primary key)
- conversationId (uuid, foreign key)
- senderId (uuid, foreign key)
- content (text)
- status (enum: sent, delivered, read)
- isEdited (boolean)
- createdAt (timestamp)
- updatedAt (timestamp)

## Mobile Integration

To integrate with your mobile app:

1. Use the authentication endpoints to sign up/login users
2. Store the access token and refresh token securely
3. Connect to Socket.IO with the access token:
   ```javascript
   const socket = io('http://your-server:3000', {
     auth: { token: accessToken }
   });
   ```
4. Listen for real-time events and emit events as needed
5. Use the REST API for initial data fetching and operations
6. Handle token refresh when needed

## Development

### Database Management

View database in Drizzle Studio:
```bash
npm run db:studio
```

Generate new migration:
```bash
npm run db:generate
```

Push schema changes directly:
```bash
npm run db:push
```

## Security Considerations

- All passwords are handled by Supabase Auth
- JWT tokens are verified on each request
- Socket.IO connections require authentication
- CORS is configured for specific origins
- SQL injection protection via Drizzle ORM
- Input validation on all endpoints

## License

MIT
