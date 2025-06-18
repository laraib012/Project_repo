// ==========================================
// routes/users.js - User API endpoints
// ==========================================
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// POST /api/users/register - Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, first_name, last_name } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                error: 'Email and password are required' 
            });
        }
        
        // Check if user already exists
        const pool = getPool();
        const existingUser = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT id FROM Users WHERE email = @email');
        
        if (existingUser.recordset.length > 0) {
            return res.status(400).json({ 
                success: false,
                error: 'User already exists' 
            });
        }
        
        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);
        
        // Create user
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .input('password_hash', sql.NVarChar, password_hash)
            .input('first_name', sql.NVarChar, first_name || '')
            .input('last_name', sql.NVarChar, last_name || '')
            .query(`
                INSERT INTO Users (email, password_hash, first_name, last_name, created_at)
                OUTPUT INSERTED.id, INSERTED.email, INSERTED.first_name, INSERTED.last_name, INSERTED.created_at
                VALUES (@email, @password_hash, @first_name, @last_name, GETDATE())
            `);
        
        const user = result.recordset[0];
        
        // Generate JWT token
        const token = jwt.sign(
            { user_id: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        res.status(201).json({
            success: true,
            data: {
                user: user,
                token: token
            },
            message: 'User registered successfully'
        });
        
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ 
            success: false,
            error: 'Failed to register user' 
        });
    }
});

// POST /api/users/login - Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                error: 'Email and password are required' 
            });
        }
        
        // Find user
        const pool = getPool();
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT id, email, password_hash, first_name, last_name FROM Users WHERE email = @email');
        
        if (result.recordset.length === 0) {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid credentials' 
            });
        }
        
        const user = result.recordset[0];
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid credentials' 
            });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { user_id: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        // Remove password hash from response
        delete user.password_hash;
        
        res.json({
            success: true,
            data: {
                user: user,
                token: token
            },
            message: 'Login successful'
        });
        
    } catch (err) {
        console.error('Error logging in user:', err);
        res.status(500).json({ 
            success: false,
            error: 'Failed to login' 
        });
    }
});

// GET /api/users/profile - Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const pool = getPool();
        const result = await pool.request()
            .input('user_id', sql.Int, req.user.user_id)
            .query('SELECT id, email, first_name, last_name, created_at FROM Users WHERE id = @user_id');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'User not found' 
            });
        }
        
        res.json({
            success: true,
            data: result.recordset[0]
        });
    } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch profile' 
        });
    }
});

module.exports = router;