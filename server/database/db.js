/**
 * Database Connection Module
 * Establishes and manages the connection to MySQL database
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
});

// Test database connection.
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection established successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

// Execute SQL query with parameters
async function query(sql, params) {
  try {
    const [results] = await pool.execute(sql, params);
 
    return results;
  } catch (error) {
    console.error('Query error:', error.message);
    throw error;
  }
}



export {
  pool,
  query,
  testConnection
};