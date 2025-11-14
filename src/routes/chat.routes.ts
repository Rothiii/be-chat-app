import { Router, Request, Response } from 'express';
import { db } from '../lib/db';
import { conversations, messages, conversationParticipants, users } from '../db/schema';
import { authenticate } from '../lib/auth';
import { eq, and, desc, asc, or, inArray, ne, gt } from 'drizzle-orm';
import { io } from '../lib/socket';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

/**
 * GET /chat/users
 * Get all users (potential contacts) with their online status
 */
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get all users except the current user
    const allUsers = await db.query.users.findMany({
      columns: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        isOnline: true,
        lastSeen: true,
      },
    });

    // Filter out current user
    const filteredUsers = allUsers.filter(user => user.id !== userId);

    res.status(200).json({ users: filteredUsers });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /chat/conversations
 * Get all conversations for the current user
 */
router.get('/conversations', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user's conversations
    const userConversations = await db.query.conversationParticipants.findMany({
      where: eq(conversationParticipants.userId, userId),
      with: {
        conversation: {
          with: {
            messages: {
              orderBy: [desc(messages.createdAt)],
              limit: 1,
            },
            participants: {
              with: {
                user: true,
              },
            },
          },
        },
      },
    });

    // Calculate unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      userConversations.map(async (cp) => {
        // Count messages created after user's last read
        const unreadMessages = await db.query.messages.findMany({
          where: and(
            eq(messages.conversationId, cp.conversationId),
            cp.lastReadAt
              ? gt(messages.createdAt, cp.lastReadAt) // Messages created after lastReadAt
              : undefined
          ),
        });

        // Count unread messages (messages after lastReadAt and not from current user)
        const unreadCount = unreadMessages.filter(msg => {
          if (!cp.lastReadAt) return msg.senderId !== userId;
          return msg.createdAt > cp.lastReadAt && msg.senderId !== userId;
        }).length;

        return {
          ...cp,
          unreadCount,
        };
      })
    );

    res.status(200).json({ conversations: conversationsWithUnread });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /chat/conversations
 * Create a new conversation
 */
router.post('/conversations', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { participantIds, name, isGroup } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      res.status(400).json({ error: 'At least one participant is required' });
      return;
    }

    // Create conversation
    const [conversation] = await db.insert(conversations).values({
      name,
      isGroup: isGroup || participantIds.length > 1,
    }).returning();

    // Add participants (including creator)
    const allParticipants = [...new Set([userId, ...participantIds])];
    await db.insert(conversationParticipants).values(
      allParticipants.map(pId => ({
        conversationId: conversation.id,
        userId: pId,
      }))
    );

    res.status(201).json({ conversation });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /chat/conversations/:conversationId/messages
 * Get messages for a specific conversation
 */
router.get('/conversations/:conversationId/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify user is participant of the conversation
    const participant = await db.query.conversationParticipants.findFirst({
      where: and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      ),
    });

    if (!participant) {
      res.status(403).json({ error: 'Not a participant of this conversation' });
      return;
    }

    // Get messages (oldest first for chat display)
    const conversationMessages = await db.query.messages.findMany({
      where: eq(messages.conversationId, conversationId),
      orderBy: [asc(messages.createdAt)],
      limit: Number(limit),
      offset: Number(offset),
      with: {
        sender: true,
      },
    });

    res.status(200).json({ messages: conversationMessages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /chat/conversations/:conversationId/messages
 * Send a message in a conversation
 */
router.post('/conversations/:conversationId/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { conversationId } = req.params;
    const { content } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!content || content.trim() === '') {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    // Verify user is participant of the conversation
    const participant = await db.query.conversationParticipants.findFirst({
      where: and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      ),
    });

    if (!participant) {
      res.status(403).json({ error: 'Not a participant of this conversation' });
      return;
    }

    // Create message
    const [message] = await db.insert(messages).values({
      conversationId,
      senderId: userId,
      content: content.trim(),
    }).returning();

    // Update conversation timestamp
    await db.update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    // Get sender info
    const sender = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    // Emit message to conversation room via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('message:new', {
        ...message,
        sender,
      });
    }

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /chat/messages/:messageId
 * Update/edit a message
 */
router.put('/messages/:messageId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { messageId } = req.params;
    const { content } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!content || content.trim() === '') {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    // Get message and verify ownership
    const message = await db.query.messages.findFirst({
      where: eq(messages.id, messageId),
    });

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (message.senderId !== userId) {
      res.status(403).json({ error: 'Not authorized to edit this message' });
      return;
    }

    // Update message
    const [updatedMessage] = await db.update(messages)
      .set({
        content: content.trim(),
        isEdited: true,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId))
      .returning();

    res.status(200).json({ message: updatedMessage });
  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /chat/messages/:messageId
 * Delete a message
 */
router.delete('/messages/:messageId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { messageId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get message and verify ownership
    const message = await db.query.messages.findFirst({
      where: eq(messages.id, messageId),
    });

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (message.senderId !== userId) {
      res.status(403).json({ error: 'Not authorized to delete this message' });
      return;
    }

    // Delete message
    await db.delete(messages).where(eq(messages.id, messageId));

    res.status(200).json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /chat/conversations/:conversationId/read
 * Mark conversation as read
 */
router.post('/conversations/:conversationId/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { conversationId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Update last read timestamp
    await db.update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      );

    // Update all messages from other users in this conversation to 'read' status
    const updatedMessages = await db.update(messages)
      .set({ status: 'read' })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          ne(messages.senderId, userId), // Only update messages NOT sent by current user
          ne(messages.status, 'read') // Only update if not already read
        )
      )
      .returning();

    // Emit socket event for each updated message
    if (updatedMessages.length > 0 && io) {
      updatedMessages.forEach((message) => {
        io.to(`conversation:${conversationId}`).emit('message:status:update', {
          messageId: message.id,
          status: 'read',
          updatedBy: userId,
        });
      });
    }

    res.status(200).json({
      message: 'Conversation marked as read',
      updatedMessagesCount: updatedMessages.length
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
