import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { supabaseAdmin } from './supabase';
import { db } from './db';
import { users, messages, conversationParticipants } from '../db/schema';
import { eq, and } from 'drizzle-orm';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

interface MessageData {
  conversationId: string;
  content: string;
}

interface TypingData {
  conversationId: string;
  isTyping: boolean;
}

interface MessageStatusData {
  messageId: string;
  status: 'delivered' | 'read';
}

/**
 * Initialize Socket.IO server
 */
export const initializeSocketServer = (httpServer: HTTPServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication middleware for Socket.IO
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify token with Supabase
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        return next(new Error('Invalid authentication token'));
      }

      // Attach user info to socket
      socket.userId = user.id;
      socket.userEmail = user.email;

      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', async (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.userId}`);

    // Update user online status
    if (socket.userId) {
      await db.update(users)
        .set({ isOnline: true, lastSeen: new Date() })
        .where(eq(users.id, socket.userId));

      // Join user's conversation rooms
      const userConversations = await db.query.conversationParticipants.findMany({
        where: eq(conversationParticipants.userId, socket.userId),
      });

      userConversations.forEach(participant => {
        socket.join(`conversation:${participant.conversationId}`);
      });

      // Emit online status to all users
      io.emit('user:online', { userId: socket.userId });
    }

    /**
     * Join a conversation room
     */
    socket.on('conversation:join', async (conversationId: string) => {
      try {
        if (!socket.userId) return;

        // Verify user is participant
        const participant = await db.query.conversationParticipants.findFirst({
          where: and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.userId, socket.userId)
          ),
        });

        if (participant) {
          socket.join(`conversation:${conversationId}`);
          socket.emit('conversation:joined', { conversationId });
        }
      } catch (error) {
        console.error('Join conversation error:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    /**
     * Leave a conversation room
     */
    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      socket.emit('conversation:left', { conversationId });
    });

    /**
     * Send a message
     */
    socket.on('message:send', async (data: MessageData) => {
      try {
        if (!socket.userId) return;

        const { conversationId, content } = data;

        if (!content || content.trim() === '') {
          socket.emit('error', { message: 'Message content is required' });
          return;
        }

        // Verify user is participant
        const participant = await db.query.conversationParticipants.findFirst({
          where: and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.userId, socket.userId)
          ),
        });

        if (!participant) {
          socket.emit('error', { message: 'Not a participant of this conversation' });
          return;
        }

        // Create message in database
        const [message] = await db.insert(messages).values({
          conversationId,
          senderId: socket.userId,
          content: content.trim(),
        }).returning();

        // Get sender info
        const sender = await db.query.users.findFirst({
          where: eq(users.id, socket.userId),
        });

        // Emit message to all participants in the conversation
        io.to(`conversation:${conversationId}`).emit('message:new', {
          ...message,
          sender,
        });

        // Emit conversation update to all participants to refresh their conversation list
        // This ensures the conversation list updates with the new message
        io.to(`conversation:${conversationId}`).emit('conversation:update', {
          conversationId,
          lastMessage: {
            ...message,
            sender,
          },
        });
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    /**
     * Typing indicator
     */
    socket.on('typing:start', async (data: TypingData) => {
      try {
        if (!socket.userId) return;

        const { conversationId } = data;

        // Emit typing status to other participants
        socket.to(`conversation:${conversationId}`).emit('typing:update', {
          conversationId,
          userId: socket.userId,
          isTyping: true,
        });
      } catch (error) {
        console.error('Typing start error:', error);
      }
    });

    socket.on('typing:stop', async (data: TypingData) => {
      try {
        if (!socket.userId) return;

        const { conversationId } = data;

        // Emit typing status to other participants
        socket.to(`conversation:${conversationId}`).emit('typing:update', {
          conversationId,
          userId: socket.userId,
          isTyping: false,
        });
      } catch (error) {
        console.error('Typing stop error:', error);
      }
    });

    /**
     * Message status update (delivered/read)
     */
    socket.on('message:status', async (data: MessageStatusData) => {
      try {
        if (!socket.userId) return;

        const { messageId, status } = data;

        // Update message status in database
        await db.update(messages)
          .set({ status })
          .where(eq(messages.id, messageId));

        // Get message to emit to sender
        const message = await db.query.messages.findFirst({
          where: eq(messages.id, messageId),
        });

        if (message) {
          // Emit status update to conversation
          io.to(`conversation:${message.conversationId}`).emit('message:status:update', {
            messageId,
            status,
            updatedBy: socket.userId,
          });
        }
      } catch (error) {
        console.error('Message status update error:', error);
      }
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.userId}`);

      // Update user online status
      if (socket.userId) {
        await db.update(users)
          .set({ isOnline: false, lastSeen: new Date() })
          .where(eq(users.id, socket.userId));

        // Emit offline status to all users
        io.emit('user:offline', { userId: socket.userId });
      }
    });
  });

  return io;
};
