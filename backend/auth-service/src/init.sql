CREATE DATABASE IF NOT EXISTS hydra_auth;
USE hydra_auth;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  email_verified BOOLEAN NOT NULL DEFAULT TRUE,
  verification_code_hash VARCHAR(64),
  verification_expires_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);