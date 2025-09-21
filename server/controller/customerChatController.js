import { query,pool } from '../database/db.js';

import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { WebSocket } from 'ws';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// WebSocket rate limiting implementation
const wsRateLimits = new Map();
const WS_MESSAGE_LIMIT = 20; // 20 messages
const WS_WINDOW_MS = 60 * 1000; // 1 minute window

// Function to check if a user has exceeded their rate limit
function checkWsRateLimit(userId) {
  const now = Date.now();
  const key = `ws:${userId}`;
  
  if (!wsRateLimits.has(key)) {
    wsRateLimits.set(key, []);
  }
  
  const timestamps = wsRateLimits.get(key);
  
  // Remove timestamps outside window
  while (timestamps.length && timestamps[0] <= now - WS_WINDOW_MS) {
    timestamps.shift();
  }
  
  // Check if limit exceeded
  if (timestamps.length >= WS_MESSAGE_LIMIT) {
    return false; // Rate limit exceeded
  }
  
  // Add current timestamp
  timestamps.push(now);
  wsRateLimits.set(key, timestamps);
  return true; // Within rate limit
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads/chat');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const fileExt = path.extname(file.originalname);
    const fileName = uuidv4() + fileExt;
    cb(null, fileName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: function (req, file, cb) {
    // Accept images and videos only
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
}).single('file');

// Handle file uploads for chat
export const uploadFile = (req, res) => {
  upload(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Return file URL
    const fileUrl = `/uploads/chat/${req.file.filename}`;
    res.json({ file_url: fileUrl });
  });
};

// Get chat history
export const getChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate user ID
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get chat messages for this user
    const messages = await query(
      `SELECT m.*, u.name as sender_name 
       FROM chat_messages m 
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id IN (
         SELECT id FROM chat_conversations WHERE customer_id = ?
       )
       ORDER BY m.timestamp DESC
       LIMIT 100`,
      [userId]
    );
    
    res.json({ messages });
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to get chat history' });
  }
};

// Get unread message count
export const getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate user ID
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get count of unread messages for this user
    const [results] = await query(
      `SELECT COUNT(*) as count 
       FROM chat_messages 
       WHERE conversation_id IN (
         SELECT id FROM chat_conversations WHERE customer_id = ?
       )
       AND sender_type = 'admin'
       AND is_read = 0`,
      [userId]
    );
    
    const unreadCount = results[0]?.count || 0;
    
    res.json({ count: unreadCount });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to get unread count' });
  }
};

// Mark message as read
export const markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    
    // Validate message ID
    if (!messageId) {
      return res.status(400).json({ error: 'Message ID is required' });
    }
    
    // Update message status
    await query(
      'UPDATE chat_messages SET is_read = 1 WHERE id = ?',
      [messageId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to mark message as read' });
  }
};

// Create new message
export const createMessage = async (req, res) => {
  try {
    const { content, media_url, sender_id, sender_type, conversation_id } = req.body;
    
    // Validate required fields
    if (!sender_id || !sender_type || !conversation_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if conversation exists, create if not
    let conversationId = conversation_id;
    if (!conversationId) {
      const [result] = await query(
        'INSERT INTO chat_conversations (customer_id, created_at) VALUES (?, NOW())',
        [sender_id]
      );
      conversationId = result.insertId;
    }
    
    // Insert new message
    const [result] = await query(
      `INSERT INTO chat_messages 
       (conversation_id, sender_id, sender_type, content, media_url, timestamp, is_read) 
       VALUES (?, ?, ?, ?, ?, NOW(), 0)`,
      [conversationId, sender_id, sender_type, content, media_url]
    );
    
    // Get the inserted message
    const [message] = await query(
      `SELECT m.*, u.name as sender_name 
       FROM chat_messages m 
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [result.insertId]
    );
    
    res.json({ message });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to create message' });
  }
};

// WebSocket handlers
export const handleWebSocketConnection = (ws, req) => {
  const userId = req.params.userId;
 
  
  if (!userId) {
    console.error('No userId provided in WebSocket connection');
    ws.close(1008, 'No userId provided');
    return;
  }

  ws.userId = userId;
  ws.isAlive = true;
  
  // Handle pings to keep connection alive
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  // Handle incoming messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'get_history':
          // Send chat history
          try {
           
            
            // Get chat history
            const messages = await getChatHistoryForUser(userId);
            
            // Safety check
            if (!Array.isArray(messages)) {
              console.error(`Invalid messages returned for user ${userId}:`, messages);
              ws.send(JSON.stringify({
                type: 'chat_history',
                messages: []
              }));
              return;
            }
            
           
            
            // Ensure the messages are properly formatted
            const formattedMessages = messages.map(msg => ({
              id: msg.id,
              conversation_id: msg.conversation_id,
              sender_id: msg.sender_id,
              sender_type: msg.sender_type,
              content: msg.content || '',
              media_url: msg.media_url,
              media_type: msg.media_type,
              timestamp: msg.timestamp,
              is_read: msg.is_read || 0,
              sender_name: msg.sender_name || (msg.sender_type === 'admin' ? 'Admin' : 'User')
            }));
            
            ws.send(JSON.stringify({
              type: 'chat_history',
              messages: formattedMessages
            }));
          } catch (err) {
            console.error(`Error getting chat history for user ${userId}:`, err);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to load chat history'
            }));
          }
          break;
          
        case 'chat_message':
          try {
            // Apply rate limiting for chat messages
            if (!checkWsRateLimit(userId)) {
              console.warn(`Rate limit exceeded for user ${userId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Rate limit exceeded. Please wait before sending more messages.'
              }));
              return;
            }
           
            // Create new message
            const newMessage = await createNewMessage(data);
            
            if (!newMessage) {
              console.error('Failed to create message, newMessage is null');
              throw new Error('Failed to create message');
            }
            
          
            
            // Broadcast to all connected admin clients
            broadcastToAdmins({
              type: 'chat_message',
              message: newMessage
            });
            
            // Send back to sender
            ws.send(JSON.stringify({
              type: 'chat_message',
              message: newMessage
            }));
            
         
          } catch (err) {
            console.error('Error creating message:', err);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to send message'
            }));
          }
          break;
          
        case 'mark_read':
          try {
            if (!data.message_id) {
              throw new Error('Message ID is required');
            }
            
            // Mark message as read
            const success = await markMessageRead(data.message_id);
            
            if (!success) {
              throw new Error('Failed to mark message as read');
            }
            
            // Broadcast read status to admins
            broadcastToAdmins({
              type: 'message_read',
              message_id: data.message_id
            });
          } catch (err) {
            console.error('Error marking message as read:', err);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to mark message as read'
            }));
          }
          break;
          
        case 'get_unread_count':
          try {
            // Send unread count
            const unreadCount = await getUnreadCountForUser(userId);
            ws.send(JSON.stringify({
              type: 'unread_count',
              count: unreadCount
            }));
          } catch (err) {
            console.error('Error getting unread count:', err);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to get unread count'
            }));
          }
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });
  
  // Handle connection close
  ws.on('close', () => {
    // Broadcast user offline status to admins
    broadcastToAdmins({
      type: 'customer_offline',
      customer_id: userId
    });
  });
  
  // Broadcast user online status to admins
  broadcastToAdmins({
    type: 'customer_online',
    customer_id: userId
  });
};

// Helper functions for WebSocket handlers
async function getChatHistoryForUser(userId) {
  try {
    // Ensure userId is a number
    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      console.error(`Invalid userId: ${userId}`);
      return [];
    }

    // Get ALL messages for this user across all conversations
    const [rows] = await pool.execute(
      `SELECT m.*, 
        CASE 
          WHEN m.sender_type = 'admin' THEN 'Admin' 
          WHEN u.username IS NOT NULL THEN u.username
          ELSE 'User'
        END as sender_name
       FROM chat_messages m 
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id IN (
         SELECT id FROM chat_conversations WHERE customer_id = ?
       )
       OR (m.sender_id = ? AND m.sender_type = 'user')
       ORDER BY m.timestamp ASC
       LIMIT 500`,
      [userIdNum, userIdNum]
    );

 
    const messages = Array.isArray(rows) ? rows : [];

   
    return messages;
  } catch (error) {
    console.error('Error getting chat history:', error);
    return [];
  }
}

async function createNewMessage(data) {
  try {
   
    
    if (!data) {
      console.error('No data provided for creating message');
      return null;
    }
    
    // Require customer_id in data
    const { content, media_url, sender_id, sender_type, sender_name, conversation_id, customer_id } = data;
    const customerId = customer_id;
    if (!customerId) {
      console.error('customer_id is required in message data');
      return null;
    }
    
    
    // Validate required fields
    if (!sender_id || !sender_type) {
      console.error('Missing required fields for creating message:', { sender_id, sender_type });
      return null;
    }
    
    // Check if conversation exists, create if not
    let conversationId = conversation_id;
   
    if (!conversationId) {
     
      let foundConvoId = null;
      const [existingMsg] = await pool.execute(
        'SELECT conversation_id FROM chat_messages WHERE sender_id = ? AND sender_type = ? ORDER BY id DESC LIMIT 1',
        [customerId, 'user']
      );
      if (existingMsg && existingMsg.length > 0) {
        foundConvoId = existingMsg[0].conversation_id;
        
      }
      if (foundConvoId) {
        conversationId = foundConvoId;
      } else {
        // Fallback: check chat_conversations by customer_id
      
        const [existingConvs] = await pool.execute(
          'SELECT id FROM chat_conversations WHERE customer_id = ? LIMIT 1',
          [customerId]
        );
      
        if (existingConvs && existingConvs.length > 0) {
          conversationId = existingConvs[0].id;
         
        } else {
          // Create new conversation
         
          try {
            const [result] = await pool.execute(
              'INSERT INTO chat_conversations (customer_id, created_at) VALUES (?, NOW())',
              [customerId]
            );
            conversationId = result.insertId;
            
          } catch (err) {
            console.error('Error creating conversation:', err);
            return null;
          }
        }
      }
    }
    
    if (!conversationId) {
      console.error('Failed to get or create conversation');
      return null;
    }
    
    // Insert new message
   
    let result;
    try {
      result = await query(
        `INSERT INTO chat_messages 
         (conversation_id, sender_id, sender_type, content, media_url, timestamp, is_read) 
         VALUES (?, ?, ?, ?, ?, NOW(), 0)`,
        [conversationId, sender_id, sender_type, content || '', media_url || null]
      );
     
    } catch (err) {
      console.error('Error inserting message:', err);
      return null;
    }
    
    if (!result || !result.insertId) {
      console.error('Failed to insert message, no insertId returned');
      return null;
    }
    
    // Create a message object with the inserted data and sender_name
    const message = {
      id: result.insertId,
      conversation_id: conversationId,
      sender_id: sender_id,
      sender_type: sender_type,
      content: content || '',
      media_url: media_url || null,
      timestamp: new Date(),
      is_read: 0,
      sender_name: sender_name || (sender_type === 'admin' ? 'Admin' : 'User')
    };
    
  
    return message;
  } catch (error) {
    console.error('Error creating message:', error);
    return null;
  }
}

async function markMessageRead(messageId) {
  try {
    if (!messageId) {
      console.error('No message ID provided for marking as read');
      return false;
    }
    
    await query(
      'UPDATE chat_messages SET is_read = 1 WHERE id = ?',
      [messageId]
    );
    
    return true;
  } catch (error) {
    console.error('Error marking message as read:', error);
    return false;
  }
}

async function getUnreadCountForUser(userId) {
  try {
    const [results] = await pool.execute(
      `SELECT COUNT(*) as count 
       FROM chat_messages 
       WHERE conversation_id IN (
         SELECT id FROM chat_conversations WHERE customer_id = ?
       )
       AND sender_type = 'admin'
       AND is_read = 0`,
      [userId]
    );
    
    return results[0]?.count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

function broadcastToAdmins(data) {
  // This function would broadcast messages to all connected admin WebSocket clients
  // Implementation depends on how WebSocket clients are managed in the application
  global.wss.clients.forEach(client => {
    if (client.isAdmin && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
} 