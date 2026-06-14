const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initializeDatabase() {
  try {
    // First, connect without database to create it if it doesn't exist
    const tempConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT
    });
    
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
    await tempConnection.end();

    // Now create tables
    console.log("Initializing tables...");
    const connection = await pool.getConnection();
    
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE,
          password VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Ensure password column exists if table was already created
      try {
         await connection.query('ALTER TABLE users ADD COLUMN password VARCHAR(255);');
      } catch(e) {
         // Ignore error if column already exists
      }

      await connection.query(`
        CREATE TABLE IF NOT EXISTS groups_table (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS group_members (
          group_id INT,
          user_id INT,
          joined_at DATE,
          left_at DATE NULL,
          PRIMARY KEY (group_id, user_id),
          FOREIGN KEY (group_id) REFERENCES groups_table(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          group_id INT,
          description VARCHAR(255),
          amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'INR',
          exchange_rate DECIMAL(10,4) DEFAULT 1.0,
          date DATE NOT NULL,
          paid_by INT,
          split_type VARCHAR(50),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups_table(id),
          FOREIGN KEY (paid_by) REFERENCES users(id)
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS expense_splits (
          id INT AUTO_INCREMENT PRIMARY KEY,
          expense_id INT,
          user_id INT,
          amount_owed DECIMAL(10,2) NOT NULL,
          FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS settlements (
          id INT AUTO_INCREMENT PRIMARY KEY,
          group_id INT,
          paid_by INT,
          paid_to INT,
          amount DECIMAL(10,2) NOT NULL,
          date DATE NOT NULL,
          FOREIGN KEY (group_id) REFERENCES groups_table(id),
          FOREIGN KEY (paid_by) REFERENCES users(id),
          FOREIGN KEY (paid_to) REFERENCES users(id)
        );
      `);

      console.log("Database initialized successfully.");
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Error initializing database:", err);
  }
}

module.exports = {
  pool,
  initializeDatabase
};
