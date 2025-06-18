const express = require("express");
const cors = require("cors");
const sql = require("mssql");
require("dotenv").config();
const { setPool } = require("./config/database");
const uploadRoutes = require("./routes/upload");
const productRoutes = require("./routes/products");

const app = express();
const PORT = process.env.PORT || 3000;



// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/api/upload", uploadRoutes);
app.use("/api/products", productRoutes);



// Database configuration
const dbConfig = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

// Global database pool
let pool;

// Initialize database connection
async function initDatabase() {
    try {
        pool = await sql.connect(dbConfig);
        console.log("✅ Connected to Azure SQL Database");
        
        // Set pool for other modules
        setPool(pool);
        
        // Test connection
        await pool.request().query("SELECT 1 as test");
        console.log("✅ Database connection test successful");
        
        return pool;
    } catch (error) {
        console.error("❌ Database connection failed:", error);
        process.exit(1);
    }
}
function getPool() {
    return pool;
}
const userRoutes = require("./routes/users");
// Make pool available globally
sql.on("connect", () => {
    console.log("Database pool connected");
});
app.use("/api/users", userRoutes);
sql.on("error", err => {
    console.error("Database pool error:", err);
});

// Routes
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "production",
        database: pool ? "connected" : "disconnected"
    });
});

app.get("/api", (req, res) => {
    res.json({
        message: "Azure Ecommerce API",
        version: "1.0.0",
        endpoints: {
            health: "GET /health",
            products: {
                list: "GET /api/products",
                create: "POST /api/products",
                get: "GET /api/products/:id",
                update: "PUT /api/products/:id",
                delete: "DELETE /api/products/:id"
            },
            orders: {
                list: "GET /api/orders",
                create: "POST /api/orders",
                get: "GET /api/orders/:id",          // Add this if you don't have it
                updateStatus: "PUT /api/orders/:id/status"  // Add this
            }
        }
    });
});

// Product routes
app.get("/api/products", async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: "Database not connected" });
        }
        
        const result = await pool.request()
            .query("SELECT * FROM products ORDER BY created_at DESC");
        
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ 
            error: "Failed to fetch products",
            message: error.message 
        });
    }
});


// ENHANCED: POST /api/products route with comprehensive debugging for image URL storage
app.post("/api/products", async (req, res) => {
    try {
        console.log("🔍 DEBUG: POST /api/products called");
        console.log("🔍 Request body:", JSON.stringify(req.body, null, 2));
        
        if (!pool) {
            console.error("❌ Database pool not available");
            return res.status(500).json({ error: "Database not connected" });
        }
        
        const { name, price, description, image_url, stock_quantity } = req.body;
        
        console.log("🔍 Extracted values:");
        console.log("  - name:", name);
        console.log("  - price:", price);
        console.log("  - description:", description);
        console.log("  - image_url:", image_url);
        console.log("  - stock_quantity:", stock_quantity);
        
        // Validation
        if (!name || !price || !description) {
            console.log("❌ Validation failed: missing required fields");
            return res.status(400).json({ 
                error: "Missing required fields: name, price, description" 
            });
        }
        
        // Prepare SQL parameters with detailed logging
        const sqlParams = {
            name: name,
            price: parseFloat(price),
            description: description,
            image_url: image_url || null,
            stock_quantity: parseInt(stock_quantity) || 0
        };
        
        console.log("🔍 SQL Parameters to be inserted:");
        console.log(JSON.stringify(sqlParams, null, 2));
        
        const result = await pool.request()
            .input("name", sql.VarChar, sqlParams.name)
            .input("price", sql.Decimal(10, 2), sqlParams.price)
            .input("description", sql.Text, sqlParams.description)
            .input("image_url", sql.VarChar, sqlParams.image_url)
            .input("stock_quantity", sql.Int, sqlParams.stock_quantity)
            .query(`
                INSERT INTO Products (name, price, description, image_url, stock_quantity, created_at) 
                OUTPUT INSERTED.*
                VALUES (@name, @price, @description, @image_url, @stock_quantity, GETDATE())
            `);
        
        const insertedProduct = result.recordset[0];
        console.log("✅ Product inserted successfully:");
        console.log(JSON.stringify(insertedProduct, null, 2));
        
        // Verify the image_url was actually stored
        if (image_url && !insertedProduct.image_url) {
            console.error("⚠️ WARNING: image_url was provided but not stored in database!");
            console.error("  - Provided image_url:", image_url);
            console.error("  - Stored image_url:", insertedProduct.image_url);
        } else if (image_url && insertedProduct.image_url) {
            console.log("✅ Image URL successfully stored in database");
        }
        
        res.status(201).json(insertedProduct);
    } catch (error) {
        console.error("❌ Error creating product:", error);
        res.status(500).json({ 
            error: "Failed to create product",
            message: error.message 
        });
    }
});

app.get("/api/products/:id", async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: "Database not connected" });
        }
        
        const result = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query("SELECT * FROM products WHERE id = @id");
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({ 
            error: "Failed to fetch product",
            message: error.message 
        });
    }
});

// Fixed Order routes for server.js - Replace your existing order routes with this

// Order routes
app.post("/api/orders", async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: "Database not connected" });
        }

        const { items, total, user_id, shipping_address } = req.body;

        console.log("Received order data:", req.body); // Debug log

        // Validation
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Items are required and must be an array" });
        }
        if (!user_id) {
            return res.status(400).json({ error: "User ID is required" });
        }
        if (!total || total <= 0) {
            return res.status(400).json({ error: "Valid total amount is required" });
        }

        // Validate each item
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.product_id || !item.quantity || !item.price) {
                return res.status(400).json({ 
                    error: `Item ${i + 1} is missing required fields: product_id, quantity, price` 
                });
            }
        }

        // Start transaction
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Insert order
            const orderResult = await transaction.request()
                .input("user_id", sql.Int, user_id)
                .input("total", sql.Decimal(10, 2), total)
                .input("shipping_address", sql.NVarChar(1000), shipping_address || null)
                .input("status", sql.NVarChar(50), "pending")
                .query(`
                    INSERT INTO Orders (user_id, total, shipping_address, status, created_at)
                    OUTPUT INSERTED.*
                    VALUES (@user_id, @total, @shipping_address, @status, GETDATE())
                `);

            const order = orderResult.recordset[0];
            console.log("Order created:", order); // Debug log

            // Insert order items and update stock
            for (const item of items) {
                // First check if product exists and has enough stock
                const stockCheck = await transaction.request()
                    .input("product_id", sql.Int, item.product_id)
                    .query("SELECT stock_quantity FROM Products WHERE id = @product_id");

                if (stockCheck.recordset.length === 0) {
                    throw new Error(`Product with ID ${item.product_id} not found`);
                }

                const currentStock = stockCheck.recordset[0].stock_quantity;
                if (currentStock < item.quantity) {
                    throw new Error(`Insufficient stock for product ID ${item.product_id}. Available: ${currentStock}, Requested: ${item.quantity}`);
                }

                // Insert order item
                await transaction.request()
                    .input("order_id", sql.Int, order.id)
                    .input("product_id", sql.Int, item.product_id)
                    .input("quantity", sql.Int, item.quantity)
                    .input("price", sql.Decimal(10, 2), item.price)
                    .query(`
                        INSERT INTO OrderItems (order_id, product_id, quantity, price)
                        VALUES (@order_id, @product_id, @quantity, @price)
                    `);

                // Update stock quantity
                await transaction.request()
                    .input("product_id", sql.Int, item.product_id)
                    .input("quantity", sql.Int, item.quantity)
                    .query(`
                        UPDATE Products 
                        SET stock_quantity = stock_quantity - @quantity
                        WHERE id = @product_id
                    `);
            }

            await transaction.commit();
            
            // Return the created order
            res.status(201).json({
                success: true,
                message: "Order created successfully",
                ...order
            });

        } catch (error) {
            await transaction.rollback();
            console.error("Transaction error:", error);
            throw error;
        }

    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({
            error: "Failed to create order",
            message: error.message,
            details: process.env.NODE_ENV === "development" ? error.stack : undefined
        });
    }
});

// COMPLETELY REWRITTEN: Get single order details with comprehensive debugging and proper data handling
app.get("/api/orders/:id", async (req, res) => {
    const orderId = req.params.id;
    
    console.log(`🔍 DEBUG: Fetching order details for ID: ${orderId}`);
    
    try {
        if (!pool) {
            console.error("❌ Database pool not available");
            return res.status(500).json({ error: "Database not connected" });
        }

        // Step 1: Check if the order exists
        console.log(`🔍 Step 1: Checking if order ${orderId} exists...`);
        const orderExistsResult = await pool.request()
            .input("orderId", sql.Int, parseInt(orderId))
            .query("SELECT COUNT(*) as count FROM Orders WHERE id = @orderId");
        
        const orderExists = orderExistsResult.recordset[0].count > 0;
        console.log(`🔍 DEBUG: Order ${orderId} exists: ${orderExists}`);
        
        if (!orderExists) {
            console.log(`❌ Order ${orderId} not found in database`);
            return res.status(404).json({ error: "Order not found" });
        }

        // Step 2: Get basic order information
        console.log(`🔍 Step 2: Fetching basic order information...`);
        const orderInfoResult = await pool.request()
            .input("orderId", sql.Int, parseInt(orderId))
            .query(`
                SELECT id, user_id, total, shipping_address, status, created_at
                FROM Orders 
                WHERE id = @orderId
            `);
        
        if (orderInfoResult.recordset.length === 0) {
            console.log(`❌ No basic order info found for ID: ${orderId}`);
            return res.status(404).json({ error: "Order not found" });
        }

        const orderInfo = orderInfoResult.recordset[0];
        console.log(`✅ Basic order info retrieved:`, orderInfo);

        // Step 3: Get order items with product details
        console.log(`🔍 Step 3: Fetching order items...`);
        const orderItemsResult = await pool.request()
            .input("orderId", sql.Int, parseInt(orderId))
            .query(`
                SELECT 
                    oi.product_id, 
                    oi.quantity, 
                    oi.price AS item_price,
                    p.name AS product_name, 
                    p.image_url AS product_image_url,
                    p.description AS product_description
                FROM OrderItems oi
                INNER JOIN Products p ON oi.product_id = p.id
                WHERE oi.order_id = @orderId
                ORDER BY oi.product_id
            `);
        
        console.log(`🔍 DEBUG: Found ${orderItemsResult.recordset.length} order items`);
        
        // Step 4: Build the complete order object
        const order = {
            id: orderInfo.id,
            user_id: orderInfo.user_id,
            total: orderInfo.total,
            shipping_address: orderInfo.shipping_address,
            status: orderInfo.status,
            created_at: orderInfo.created_at,
            items: orderItemsResult.recordset.map(item => {
                console.log(`🔍 Processing item:`, item);
                return {
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    price: item.item_price,
                    image_url: item.product_image_url,
                    description: item.product_description
                };
            })
        };

        console.log(`✅ Successfully fetched order ${orderId} with ${order.items.length} items`);
        console.log(`🔍 Final order object:`, JSON.stringify(order, null, 2));
        
        res.json(order);
        
    } catch (error) {
        console.error(`❌ Error fetching order details for ID ${orderId}:`, error);
        res.status(500).json({ 
            error: "Internal server error", 
            message: error.message,
            debug: process.env.NODE_ENV === "development" ? error.stack : undefined
        });
    }
});


// Get orders endpoint
app.get("/api/orders", async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: "Database not connected" });
        }
        
        const result = await pool.request()
            .query(`
                SELECT o.*, 
                       COUNT(oi.id) as item_count
                FROM Orders o
                LEFT JOIN OrderItems oi ON o.id = oi.order_id
                GROUP BY o.id, o.user_id, o.total, o.status, o.shipping_address, o.created_at
                ORDER BY o.created_at DESC
            `);
        
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ 
            error: "Failed to fetch orders",
            message: error.message 
        });
    }
});

// FIXED: Update order status with proper SQL Server syntax
app.put("/api/orders/:id/status", async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;
        
        console.log(`🔍 DEBUG: Updating order ${orderId} status to: ${status}`);
        
        // Validate status
        const validStatuses = ["pending", "shipped", "delivered"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        
        if (!pool) {
            return res.status(500).json({ error: "Database not connected" });
        }
        
        // Update order status in database using proper SQL Server syntax
        const result = await pool.request()
            .input("status", sql.NVarChar(50), status)
            .input("orderId", sql.Int, parseInt(orderId))
            .query("UPDATE Orders SET status = @status WHERE id = @orderId");
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Order not found" });
        }
        
        console.log(`✅ Successfully updated order ${orderId} status to ${status}`);
        
        res.json({ 
            success: true, 
            message: "Order status updated successfully",
            orderId: orderId,
            status: status
        });
        
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ 
            error: "Internal server error",
            message: error.message 
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error("Unhandled error:", error);
    res.status(500).json({ 
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? error.message : "Something went wrong"
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
});

// Add DELETE route for products (add this with other product routes)
app.delete("/api/products/:id", async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: "Database not connected" });
        }
        
        const result = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query("DELETE FROM Products WHERE id = @id");
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        
        res.json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ 
            error: "Failed to delete product",
            message: error.message 
        });
    }
});

// ENHANCED: PUT route with comprehensive debugging for image URL updates
app.put("/api/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, description, image_url, stock_quantity } = req.body;

        console.log("🔍 DEBUG: PUT /api/products/:id called");
        console.log("🔍 Product ID from URL:", id);
        console.log("🔍 Request body:", JSON.stringify(req.body, null, 2));
        console.log("🔍 Extracted values:", { name, price, description, image_url, stock_quantity });
        
        // Validate required fields
        if (!name || !price) {
            console.log("❌ Validation failed: missing name or price");
            return res.status(400).json({ error: "Name and price are required" });
        }

        const request = pool.request();
        
        // Build dynamic query based on provided fields
        let query = "UPDATE Products SET ";
        let setParts = [];
        
        if (name) {
            request.input("name", sql.NVarChar, name);
            setParts.push("name = @name");
        }
        
        if (price) {
            request.input("price", sql.Decimal(10, 2), parseFloat(price));
            setParts.push("price = @price");
        }

        if (description !== undefined) {
            request.input("description", sql.Text, description);
            setParts.push("description = @description");
        }

        if (image_url !== undefined) {
            console.log("🔍 Setting image_url to:", image_url);
            request.input("image_url", sql.VarChar, image_url);
            setParts.push("image_url = @image_url");
        }

        if (stock_quantity !== undefined) {
            request.input("stock_quantity", sql.Int, parseInt(stock_quantity));
            setParts.push("stock_quantity = @stock_quantity");
        }

        query += setParts.join(", ");
        query += " WHERE id = @id";
        request.input("id", sql.Int, id);

        console.log("🔍 Generated SQL Query:", query);

        const result = await request.query(query);
        
        if (result.rowsAffected[0] === 0) {
            console.log("❌ Product not found for update:", id);
            return res.status(404).json({ error: "Product not found" });
        }
        console.log("🧪 Final SQL params before update:", {
    name, price, description, image_url, stock_quantity
});

        // Fetch the updated product to return it
        const updatedProductResult = await pool.request()
            .input("id", sql.Int, id)
            .query("SELECT * FROM Products WHERE id = @id");

        const updatedProduct = updatedProductResult.recordset[0];
        console.log("✅ Product updated successfully:");
        console.log(JSON.stringify(updatedProduct, null, 2));
        
        // Verify the image_url was actually updated if provided
        if (image_url !== undefined && updatedProduct.image_url !== image_url) {
            console.error("⚠️ WARNING: image_url was provided but not updated in database!");
            console.error("  - Provided image_url:", image_url);
            console.error("  - Stored image_url:", updatedProduct.image_url);
        } else if (image_url !== undefined && updatedProduct.image_url === image_url) {
            console.log("✅ Image URL successfully updated in database");
        }
        
        res.json(updatedProduct);

    } catch (error) {
        console.error("❌ Error updating product:", error);
        res.status(500).json({ 
            error: "Failed to update product",
            message: error.message 
        });
    }
});
app.use(express.static("./frontend/build"));

app.get("*", (req, res) => {
    res.sendFile(Path2D.resolve(__dirname, "frontend", "build", "index.html"))
});
// Start the server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});

