import { query } from '../database/db.js';
import { pool } from '../database/db.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { WebSocket } from 'ws';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Get all conversations
export const getConversations = async (req, res) => {
  try {
    // Get all conversations with last message and unread count
    const [conversations] = await pool.execute(`
      SELECT 
        c.id,
        c.customer_id,
        u.username as customer_name,
        c.priority,
        c.created_at,
        (
          SELECT content 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT timestamp 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) as last_message_time,
        (
          SELECT COUNT(*) 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          AND sender_type = 'user' 
          AND is_read = 0
        ) as unread_count
      FROM chat_conversations c
      JOIN users u ON c.customer_id = u.id
      ORDER BY last_message_time DESC
    `);


    
    res.json({ conversations });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to get conversations' });
  }
};

// Get chat history for a conversation
export const getChatHistory = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Validate conversation ID
    if (!conversationId) {
      return res.status(200).json({ status: "error", success: false, message: 'Conversation ID is required' });
    }
    
    // Get chat messages for this conversation
    const [messages] = await query(
      `SELECT m.*, u.username as sender_name 
       FROM chat_messages m 
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.timestamp ASC`,
      [conversationId]
    );
    
    res.json({ messages });
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to get chat history' });
  }
};

// Get unread message count across all conversations
export const getUnreadCount = async (req, res) => {
  try {
    // Get count of all unread messages from customers
    const [result] = await query(`
      SELECT COUNT(*) as count 
      FROM chat_messages 
      WHERE sender_type = 'user' 
      AND is_read = 0
    `);
    
    const unreadCount = result[0].count || 0;
    
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
      return res.status(200).json({ status: "error", success: false, message: 'Message ID is required' });
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
    const { content, media_url, sender_id, sender_type, conversation_id, customer_id } = req.body;
    
    // Validate required fields
    if (!sender_id || !sender_type || !conversation_id) {
      return res.status(200).json({ status: "error", success: false, message: 'Missing required fields' });
    }
    
    // Insert new message
    const [result] = await query(
      `INSERT INTO chat_messages 
       (conversation_id, sender_id, sender_type, content, media_url, timestamp, is_read) 
       VALUES (?, ?, ?, ?, ?, NOW(), 0)`,
      [conversation_id, sender_id, sender_type, content, media_url]
    );
    
    // Get the inserted message
    const [messages] = await query(
      `SELECT m.*, u.username as sender_name 
       FROM chat_messages m 
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [result.insertId]
    );
    
    const message = messages[0];
    
    res.json({ message });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to create message' });
  }
};

// Update conversation priority
export const updatePriority = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { priority } = req.body;
    
    // Validate inputs
    if (!conversationId) {
      return res.status(200).json({ status: "error", success: false, message: 'Conversation ID is required' });
    }
    
    if (!['high', 'medium', 'low'].includes(priority)) {
      return res.status(200).json({ status: "error", success: false, message: 'Invalid priority level' });
    }
    
    // Update priority
    await query(
      'UPDATE chat_conversations SET priority = ? WHERE id = ?',
      [priority, conversationId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating priority:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to update priority' });
  }
};

// Filter conversations
export const filterConversations = async (req, res) => {
  try {
    const { filter } = req.query;
    
    let queryString = `
      SELECT 
        c.id,
        c.customer_id,
        u.username as customer_name,
        c.priority,
        c.created_at,
        (
          SELECT content 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT timestamp 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) as last_message_time,
        (
          SELECT COUNT(*) 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          AND sender_type = 'user' 
          AND is_read = 0
        ) as unread_count
      FROM chat_conversations c
      JOIN users u ON c.customer_id = u.id
    `;
    
    // Apply filter
    if (filter === 'unread') {
      queryString += ` 
        WHERE (
          SELECT COUNT(*) 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          AND sender_type = 'user' 
          AND is_read = 0
        ) > 0
      `;
    } else if (filter === 'today') {
      queryString += ` 
        WHERE DATE(
          SELECT timestamp 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) = CURDATE()
      `;
    } else if (filter === 'yesterday') {
      queryString += ` 
        WHERE DATE(
          SELECT timestamp 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      `;
    } else if (filter === 'high') {
      queryString += ` WHERE c.priority = 'high'`;
    } else if (filter === 'medium') {
      queryString += ` WHERE c.priority = 'medium'`;
    } else if (filter === 'low') {
      queryString += ` WHERE c.priority = 'low'`;
    }
    
    queryString += ` ORDER BY last_message_time DESC`;
    
    const [conversations] = await query(queryString);
    
    res.json({ conversations });
  } catch (error) {
    console.error('Error filtering conversations:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to filter conversations' });
  }
};

// Search conversations
export const searchConversations = async (req, res) => {
  try {
    const { query: searchQuery } = req.query;
    
    if (!searchQuery) {
      return res.status(200).json({ status: "error", success: false, message: 'Search query is required' });
    }
    
    // Search conversations by customer name or message content
    const [conversations] = await pool.execute(`
      SELECT 
        c.id,
        c.customer_id,
        u.username as customer_name,
        c.priority,
        c.created_at,
        (
          SELECT content 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT timestamp 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) as last_message_time,
        (
          SELECT COUNT(*) 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          AND sender_type = 'user' 
          AND is_read = 0
        ) as unread_count
      FROM chat_conversations c
      JOIN users u ON c.customer_id = u.id
      WHERE u.username LIKE ? OR 
      c.id IN (
        SELECT DISTINCT conversation_id 
        FROM chat_messages 
        WHERE content LIKE ?
      )
      ORDER BY last_message_time DESC
    `, [`%${searchQuery}%`, `%${searchQuery}%`]);
    
    res.json({ conversations });
  } catch (error) {
    console.error('Error searching conversations:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to search conversations' });
  }
};

// // Block user (real implementation)
// export const blockUser = async (req, res) => {
//   const userId = req.params.id;
//   const { reason } = req.body;
//   const adminId = req.user?.id;
//   try {
//     await pool.execute(
//       `INSERT INTO user_moderation (user_id, action, reason, admin_id)
//        VALUES (?, 'block', ?, ?)`,
//       [userId, reason || null, adminId || null]
//     );
//     res.json({ success: true });
//   } catch (err) {
//     console.error('Error blocking user:', err);
//     res.status(200).json({ status: "error", success: false, message: 'Failed to block user' });
//   }
// };

// Timeout user (real implementation)
// export const timeoutUser = async (req, res) => {
//   const userId = req.params.id;
//   const { reason, minutes } = req.body;
//   const adminId = req.user?.id;
//   const timeoutMinutes = parseInt(minutes, 10) || 30;
//   const until = new Date(Date.now() + timeoutMinutes * 60000);
//   try {
//     await pool.execute(
//       `INSERT INTO user_moderation (user_id, action, reason, timeout_until, admin_id)
//        VALUES (?, 'timeout', ?, ?, ?)`,
//       [userId, reason || null, until, adminId || null]
//     );
//     res.json({ success: true });
//   } catch (err) {
//     console.error('Error timing out user:', err);
//     res.status(200).json({ status: "error", success: false, message: 'Failed to timeout user' });
//   }
// };

// // Unblock user (resolve block/timeout)
// export const unblockUser = async (req, res) => {
//   const userId = req.params.id;
//   try {
//     await pool.execute(
//       `UPDATE user_moderation SET resolved = 1, resolved_at = NOW() WHERE user_id = ? AND resolved = 0`,
//       [userId]
//     );
//     res.json({ success: true });
//   } catch (err) {
//     console.error('Error unblocking user:', err);
//     res.status(200).json({ status: "error", success: false, message: 'Failed to unblock user' });
//   }
// };

// Helper: Check if user is blocked/timed out (for enforcement)
// export async function isUserBlockedOrTimedOut(userId) {
//   const [rows] = await pool.execute(
//     `SELECT * FROM user_moderation WHERE user_id = ? AND resolved = 0 AND
//       ((action = 'block') OR (action = 'timeout' AND timeout_until > NOW())) LIMIT 1`,
//     [userId]
//   );
//   return rows.length > 0;
// }

// WebSocket handlers
export const handleWebSocketConnection = (ws, req) => {
  const adminId = req.params.adminId;
  
  
  if (!adminId) {
    console.error('No adminId provided in WebSocket connection');
    ws.close(1008, 'No adminId provided');
    return;
  }
  
  ws.adminId = adminId;
  ws.isAdmin = true;
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
        case 'get_conversations':
          // Send conversations list
          let conversations = await getAllConversations();
          if (!Array.isArray(conversations)) {
            conversations = conversations ? [conversations] : [];
          }
          ws.send(JSON.stringify({
            type: 'conversations',
            conversations
          }));
          break;
          
        case 'get_history':
          try {
            // Send chat history for a conversation
            if (!data.conversation_id) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Conversation ID is required'
              }));
              break;
            }
            
           
            
            // Get chat history
            const messages = await getChatHistoryForConversation(data.conversation_id);
            
            // Safety check
            if (!Array.isArray(messages)) {
              console.error(`Invalid messages returned for conversation ${data.conversation_id}:`, messages);
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
            console.error(`Error getting chat history for admin:`, err);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to load chat history'
            }));
          }
          break;
          
        case 'chat_message':
          try {
           
            
            // Create new message
            const newMessage = await createNewMessage(data);
            
            if (!newMessage) {
              console.error('Failed to create admin message, newMessage is null');
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to send message'
              }));
              break;
            }
            
         
            
            // Broadcast to customer
            broadcastToCustomer(data.customer_id, {
              type: 'chat_message',
              message: newMessage
            });
            
            // Broadcast the full updated conversation list to all admins
            const allConversations = await getAllConversations();
            broadcastToAdmins({
              type: 'conversations',
              conversations: Array.isArray(allConversations) ? allConversations : (allConversations ? [allConversations] : [])
            });
            
            // Send back to sender
            ws.send(JSON.stringify({
              type: 'chat_message',
              message: newMessage
            }));
            
          
          } catch (err) {
            console.error('Error creating admin message:', err);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to send message'
            }));
          }
          break;
          
        case 'mark_read':
          // Mark message as read
          await markMessageRead(data.message_id);
          
          // Broadcast read status to other admins
          broadcastToAdmins({
            type: 'message_read',
            message_id: data.message_id
          }, adminId);
          break;
          
        case 'get_unread_count':
          // Send unread count
          const unreadCount = await getTotalUnreadCount();
          ws.send(JSON.stringify({
            type: 'unread_count',
            count: unreadCount
          }));
          break;
          
        case 'set_priority':
          // Update conversation priority
          if (!data.conversation_id || !['high', 'medium', 'low'].includes(data.priority)) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid priority update request'
            }));
            break;
          }
          
          await updateConversationPriority(data.conversation_id, data.priority);
          
          // Broadcast priority update to all admins
          broadcastToAdmins({
            type: 'priority_updated',
            conversation_id: data.conversation_id,
            priority: data.priority
          });
          break;
          
        case 'filter_conversations':
          // Filter conversations
          let filteredConversations = await filterConversationsByType(data.filter);
          if (!Array.isArray(filteredConversations)) {
            filteredConversations = filteredConversations ? [filteredConversations] : [];
          }
          ws.send(JSON.stringify({
            type: 'conversations',
            conversations: filteredConversations
          }));
          break;
          
        case 'search_conversations':
          // Search conversations
          let searchResults = await searchConversationsByQuery(data.query);
          if (!Array.isArray(searchResults)) {
            searchResults = searchResults ? [searchResults] : [];
          }
          ws.send(JSON.stringify({
            type: 'conversations',
            conversations: searchResults
          }));
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });
};

// Helper functions for WebSocket handlers
async function getAllConversations() {
  try {
    const [conversations] = await pool.execute(`
      SELECT 
        c.id,
        c.customer_id,
        u.username as customer_name,
        c.priority,
        c.created_at,
        (
          SELECT content 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT timestamp 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) as last_message_time,
        (
          SELECT COUNT(*) 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          AND sender_type = 'user' 
          AND is_read = 0
        ) as unread_count,
        (
          SELECT COUNT(*) > 0
          FROM users_online
          WHERE user_id = c.customer_id
        ) as is_online
      FROM chat_conversations c
      JOIN users u ON c.customer_id = u.id
      ORDER BY last_message_time DESC
    `);
    
   
    return conversations;
  } catch (error) {
    console.error('Error getting all conversations:', error);
    return [];
  }
}

async function getChatHistoryForConversation(conversationId) {
  try {
  
    
    // Ensure conversationId is a number
    const convId = parseInt(conversationId, 10);
    if (isNaN(convId)) {
      console.error(`Invalid conversationId: ${conversationId}`);
      return [];
    }
    
    // Use pool.execute to get all messages for the conversation, ordered by timestamp ascending
    const [rows] = await pool.execute(
      `SELECT m.*, 
        CASE 
          WHEN m.sender_type = 'admin' THEN 'Admin' 
          WHEN u.username IS NOT NULL THEN u.username
          ELSE 'User'
        END as sender_name
       FROM chat_messages m 
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.timestamp ASC
       LIMIT 500`,
      [convId]
    );

    
    
    // Ensure we have an array
    const messages = Array.isArray(rows) ? rows : [];
    
   
    
  
    
    return messages;
  } catch (error) {
    console.error('Error getting chat history for conversation:', error);
    return [];
  }
}

async function createNewMessage(data) {
  try {
   
    const { content, media_url, sender_id, sender_type, sender_name, conversation_id, customer_id } = data;

    let convId = conversation_id;
    // If no conversation_id is provided, find or create one (universal per customer)
    if (!convId) {
      // Try to find an existing conversation for this customer
      const [existing] = await pool.execute(
        `SELECT id FROM chat_conversations WHERE customer_id = ? LIMIT 1`,
        [customer_id]
      );
      if (existing && existing.length > 0) {
        convId = existing[0].id;
      } else {
        // Create a new conversation
        const [result] = await pool.execute(
          `INSERT INTO chat_conversations (customer_id, created_at) VALUES (?, NOW())`,
          [customer_id]
        );
        convId = result.insertId;
      }
    }

    // Insert new message
    const [msgResult] = await pool.execute(
      `INSERT INTO chat_messages 
       (conversation_id, sender_id, sender_type, content, media_url, timestamp, is_read) 
       VALUES (?, ?, ?, ?, ?, NOW(), 0)`,
      [convId, sender_id, sender_type, content || '', media_url || null]
    );

    if (!msgResult || !msgResult.insertId) {
      console.error('Failed to insert message, no insertId returned');
      return null;
    }

    // Fetch the inserted message with sender_name
    const [rows] = await pool.execute(
      `SELECT m.*, 
        CASE 
          WHEN m.sender_type = 'admin' THEN 'Admin' 
          WHEN u.username IS NOT NULL THEN u.username
          ELSE 'User'
        END as sender_name
       FROM chat_messages m 
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [msgResult.insertId]
    );
    const message = rows[0];
    message.conversation_id = convId;
  
    return message;
  } catch (error) {
    console.error('Error creating message:', error);
    return null;
  }
}

async function markMessageRead(messageId) {
  try {
    await query(
      'UPDATE chat_messages SET is_read = 1 WHERE id = ?',
      [messageId]
    );
    
    return true;
  } catch (error) {
    console.error('Error marking message as read:', error);
    throw error;
  }
}

async function getTotalUnreadCount() {
  try {
    const [results] = await query(`
      SELECT COUNT(*) as count 
      FROM chat_messages 
      WHERE sender_type = 'user' 
      AND is_read = 0
    `);
    if (results && results[0] && typeof results[0].count !== 'undefined') {
      return results[0].count;
    } else {
      return 0;
    }
  } catch (error) {
    console.error('Error getting total unread count:', error);
    return 0;
  }
}

async function updateConversationPriority(conversationId, priority) {
  try {
    await query(
      'UPDATE chat_conversations SET priority = ? WHERE id = ?',
      [priority, conversationId]
    );
    
    return true;
  } catch (error) {
    console.error('Error updating conversation priority:', error);
    throw error;
  }
}

async function filterConversationsByType(filter) {
  try {
    let queryString = `
      SELECT 
        c.id,
        c.customer_id,
        u.username as customer_name,
        c.priority,
        c.created_at,
        (
          SELECT content 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT timestamp 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) as last_message_time,
        (
          SELECT COUNT(*) 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          AND sender_type = 'user' 
          AND is_read = 0
        ) as unread_count,
        (
          SELECT COUNT(*) > 0
          FROM users_online
          WHERE user_id = c.customer_id
        ) as is_online
      FROM chat_conversations c
      JOIN users u ON c.customer_id = u.id
    `;
    
    // Apply filter
    if (filter === 'unread') {
      queryString += ` 
        WHERE (
          SELECT COUNT(*) 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          AND sender_type = 'user' 
          AND is_read = 0
        ) > 0
      `;
    } else if (filter === 'today') {
      queryString += ` 
        WHERE DATE(
          SELECT timestamp 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) = CURDATE()
      `;
    } else if (filter === 'yesterday') {
      queryString += ` 
        WHERE DATE(
          SELECT timestamp 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      `;
    } else if (filter === 'high') {
      queryString += ` WHERE c.priority = 'high'`;
    } else if (filter === 'medium') {
      queryString += ` WHERE c.priority = 'medium'`;
    } else if (filter === 'low') {
      queryString += ` WHERE c.priority = 'low'`;
    }
    
    queryString += ` ORDER BY last_message_time DESC`;
    
    const [conversations] = await query(queryString);
    
    return conversations;
  } catch (error) {
    console.error('Error filtering conversations:', error);
    return [];
  }
}

async function searchConversationsByQuery(searchQuery) {
  try {
    if (!searchQuery) {
      return await getAllConversations();
    }
    
    const [conversations] = await query(`
      SELECT 
        c.id,
        c.customer_id,
        u.username as customer_name,
        c.priority,
        c.created_at,
        (
          SELECT content 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT timestamp 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) as last_message_time,
        (
          SELECT COUNT(*) 
          FROM chat_messages 
          WHERE conversation_id = c.id 
          AND sender_type = 'user' 
          AND is_read = 0
        ) as unread_count,
        (
          SELECT COUNT(*) > 0
          FROM users_online
          WHERE user_id = c.customer_id
        ) as is_online
      FROM chat_conversations c
      JOIN users u ON c.customer_id = u.id
      WHERE u.username LIKE ? OR 
      c.id IN (
        SELECT DISTINCT conversation_id 
        FROM chat_messages 
        WHERE content LIKE ?
      )
      ORDER BY last_message_time DESC
    `, [`%${searchQuery}%`, `%${searchQuery}%`]);
    
    return conversations;
  } catch (error) {
    console.error('Error searching conversations:', error);
    return [];
  }
}

function broadcastToCustomer(customerId, data) {
  // This function would broadcast messages to the specific customer WebSocket client
  global.wss.clients.forEach(client => {
    if (client.userId === String(customerId) && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function broadcastToAdmins(data, excludeAdminId = null) {
  // This function would broadcast messages to all admin WebSocket clients except the sender
  global.wss.clients.forEach(client => {
    if (client.isAdmin && client.adminId !== excludeAdminId && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
} 