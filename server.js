require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'cost_apk';

// Middleware
app.use(cors({
  origin: '*', // В продакшене укажите конкретный origin
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// MongoDB клиент
let db;
const client = new MongoClient(MONGO_URI);

async function connectDB() {
  try {
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`✅ Connected to MongoDB: ${MONGO_URI} / ${DB_NAME}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/products — добавить товар
app.post('/api/products', async (req, res) => {
  try {
    const { name, price } = req.body;

    // Валидация
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Поле "name" обязательно и должно быть строкой.' });
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Поле "price" должно быть числом >= 0.' });
    }

    const product = {
      name: name.trim(),
      price: parsedPrice,
      createdAt: new Date(),
    };

    const result = await db.collection('products').insertOne(product);
    return res.status(201).json({
      message: 'Товар успешно добавлен',
      id: result.insertedId,
      product,
    });
  } catch (err) {
    console.error('POST /api/products error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
  }
});

// GET /api/products — поиск товаров
// Query params: name (строка), minPrice (число), maxPrice (число)
app.get('/api/products', async (req, res) => {
  try {
    const { name, minPrice, maxPrice } = req.query;
    const filter = {};

    if (name && name.trim() !== '') {
      // Регистронезависимый поиск по подстроке
      filter.name = { $regex: name.trim(), $options: 'i' };
    }

    const priceFilter = {};
    if (minPrice !== undefined && minPrice !== '') {
      const min = parseFloat(minPrice);
      if (!isNaN(min)) priceFilter.$gte = min;
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      const max = parseFloat(maxPrice);
      if (!isNaN(max)) priceFilter.$lte = max;
    }
    if (Object.keys(priceFilter).length > 0) {
      filter.price = priceFilter;
    }

    const products = await db
      .collection('products')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return res.json(products.map(p => ({
      id: p._id.toString(),
      name: p.name,
      price: p.price,
      createdAt: p.createdAt,
    })));
  } catch (err) {
    console.error('GET /api/products error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
  }
});

// DELETE /api/products/:id — удалить товар
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Некорректный ID товара.' });
    }
    const result = await db.collection('products').deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Товар не найден.' });
    }
    return res.json({ message: 'Товар удалён.' });
  } catch (err) {
    console.error('DELETE /api/products/:id error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Products: http://localhost:${PORT}/api/products`);
  });

  // Self-ping каждые 25 секунд чтобы Render не усыплял сервис
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `https://sherali-app-backend.onrender.com`;
  setInterval(() => {
    https.get(`${SELF_URL}/api/health`, (res) => {
      console.log(`🔔 Self-ping: ${res.statusCode}`);
    }).on('error', (err) => {
      console.warn(`⚠️ Self-ping failed: ${err.message}`);
    });
  }, 25 * 1000);
});
