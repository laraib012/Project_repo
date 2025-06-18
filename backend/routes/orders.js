const express = require('express');
const sql = require('mssql');
const router = express.Router();

// POST /orders
// POST /orders handler
async function createOrder(req, res) {
  const { user_id, total, shipping_address, items } = req.body;

  if (!user_id || !total || !shipping_address || !items || !items.length) {
    return res.status(400).json({ error: 'Invalid order data' });
  }

  try {
    let pool = await sql.connect(config);

    // Start transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Insert into Orders and get order id
      const orderInsertResult = await transaction.request()
        .input('user_id', sql.Int, user_id)
        .input('total', sql.Decimal(10,2), total)
        .input('shipping_address', sql.NVarChar(1000), shipping_address)
        .query(`INSERT INTO Orders (user_id, total, shipping_address)
                OUTPUT INSERTED.id
                VALUES (@user_id, @total, @shipping_address)`);

      const orderId = orderInsertResult.recordset[0].id;

      // Insert each item
      for (const item of items) {
        await transaction.request()
          .input('order_id', sql.Int, orderId)
          .input('product_id', sql.Int, item.product_id)
          .input('quantity', sql.Int, item.quantity)
          .input('price', sql.Decimal(10, 2), item.price)
          .query(`INSERT INTO OrderItems (order_id, product_id, quantity, price)
                  VALUES (@order_id, @product_id, @quantity, @price)`);

        // Optional: Update stock quantity
        await transaction.request()
          .input('product_id', sql.Int, item.product_id)
          .input('quantity', sql.Int, item.quantity)
          .query(`UPDATE Products
                  SET stock_quantity = stock_quantity - @quantity
                  WHERE id = @product_id AND stock_quantity >= @quantity`);
      }

      await transaction.commit();

      res.json({ success: true, data: { order_id: orderId, total } });

    } catch (err) {
      await transaction.rollback();
      console.error('Transaction error:', err);
      res.status(500).json({ error: 'Failed to create order' });
    }
  } catch (err) {
    console.error('DB connection error:', err);
    res.status(500).json({ error: 'Database connection failed' });
  }
}

module.exports = { createOrder };