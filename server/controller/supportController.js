import { pool } from '../database/db.js';

// List tickets with optional filters
export async function getSupportTickets(req, res) {
  try {
    const { status, date, q } = req.query;

    


 
    let sql = 'SELECT * FROM support_tickets WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (date) { sql += ' AND DATE(created_at) = ?'; params.push(date); }
    if (q) { sql += ' AND (username LIKE ? OR subject LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.execute(sql, params);
   
    res.json(rows);
  } catch (err) {
    res.status(200).json({ status: 'error', success: false, message: 'Failed to fetch tickets' });
  
  }
}

// Get single ticket
export async function getSupportTicketById(req, res) {
  
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT * FROM support_tickets WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(200).json({ status: 'error', success: false, message: 'Failed to fetch ticket' });
  }
}

// Update status
export async function updateSupportTicketStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
 
    const allowed = ['open', 'pending', 'resolved', 'closed'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    await pool.execute('UPDATE support_tickets SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
    res.json({ success: true });

  } catch (err) {
    res.status(200).json({ status: 'error', success: false, message: 'Failed to update status' });
  }
}

// Delete ticket
export async function deleteSupportTicket(req, res) {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM support_tickets WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(200).json({ status: 'error', success: false, message: 'Failed to delete ticket' });
  }
}

// Reply to ticket
export async function replySupportTicket(req, res) {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });
    await pool.execute('UPDATE support_tickets SET admin_reply = ?, replied_at = NOW(), updated_at = NOW() WHERE id = ?', [message, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(200).json({ status: 'error', success: false, message: 'Failed to send reply' });
  }
}

// Create support ticket (customer)
export async function createSupportTicket(req, res) {
  try {
    const { subject, message } = req.body;
    const user = req.userInfo;
    if (!user) return res.status(200).json({ status: 'error', success: false, message: 'Unauthorized' });
    await pool.execute(
      'INSERT INTO support_tickets (user_id, username, email, subject, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [user.id, user.username, user.email, subject, message, 'open']
    );
  
    res.json({ success: true });
  } catch (err) {
    res.status(200).json({ status: 'error', success: false, message: 'Failed to create support ticket' });
  }
}

// Get tickets for the logged-in customer
export async function getMySupportTickets(req, res) {

  try {
    const user = req.user;
    const { status, date, q } = req.query;
    let sql = 'SELECT * FROM support_tickets WHERE user_id = ?';
    const params = [user];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (date) { sql += ' AND DATE(created_at) = ?'; params.push(date); }
    if (q) { sql += ' AND (subject LIKE ? OR message LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(200).json({ status: 'error', success: false, message: 'Failed to fetch your tickets' });
  }
} 