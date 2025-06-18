// routes/products.js
const express = require('express');
const router = express.Router();
const sql = require('mssql');

// GET all products
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .query('SELECT * FROM products ORDER BY created_at DESC');
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ 
            error: 'Failed to fetch products',
            message: error.message 
        });
    }
});

// GET single product
router.get('/:id', async (req, res) => {
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM products WHERE id = @id');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ 
            error: 'Failed to fetch product',
            message: error.message 
        });
    }
});

// POST new product
router.post('/', async (req, res) => {
    try {
        const { name, price, description, image_url, stock_quantity } = req.body;
        
        // Validation
        if (!name || !price || !description) {
            return res.status(400).json({ 
                error: 'Missing required fields: name, price, description' 
            });
        }
        
        const pool = await sql.connect();
        const result = await pool.request()
            .input('name', sql.VarChar, name)
            .input('price', sql.Decimal(10, 2), price)
            .input('description', sql.Text, description)
            .input('image_url', sql.VarChar, image_url || null)
            .input('stock_quantity', sql.Int, stock_quantity || 0)
            .query(`
                INSERT INTO products (name, price, description, image_url, stock_quantity, created_at) 
                OUTPUT INSERTED.*
                VALUES (@name, @price, @description, @image_url, @stock_quantity, GETDATE())
            `);
        
        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ 
            error: 'Failed to create product',
            message: error.message 
        });
    }
});

// PUT update product - FIXED to include stock_quantity
router.put('/:id', async (req, res) => {
    try {
        const { name, price, description, image_url, stock_quantity } = req.body;
        
        console.log('🛠️ DEBUG: Updating product with data:', { name, price, description, image_url, stock_quantity });
        
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('name', sql.VarChar, name)
            .input('price', sql.Decimal(10, 2), price)
            .input('description', sql.Text, description)
            .input('image_url', sql.VarChar, image_url)
            .input('stock_quantity', sql.Int, stock_quantity || 0)
            .query(`
                UPDATE Products 
                SET name = @name, price = @price, description = @description, image_url = @image_url, stock_quantity = @stock_quantity, updated_at = GETDATE()
                OUTPUT INSERTED.*
                WHERE id = @id
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        console.log('✅ Product updated successfully:', result.recordset[0]);
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ 
            error: 'Failed to update product',
            message: error.message 
        });
    }
});

// DELETE product
router.delete('/:id', async (req, res) => {
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM products WHERE id = @id');
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ 
            error: 'Failed to delete product',
            message: error.message 
        });
    }
});

module.exports = router;

