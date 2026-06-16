require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME   = process.env.DB_NAME   || 'cost_apk';

// ─── Тестовые данные ──────────────────────────────────────────────────────────
const SEED_PRODUCTS = [
  { name: 'Ноутбук Lenovo IdeaPad',  price: 54990, createdAt: new Date() },
  { name: 'Мышь Logitech MX Master', price: 6990,  createdAt: new Date() },
  { name: 'Клавиатура Keychron K2',  price: 12500, createdAt: new Date() },
  { name: 'Монитор Samsung 27"',     price: 28000, createdAt: new Date() },
  { name: 'Наушники Sony WH-1000XM5',price: 29990, createdAt: new Date() },
  { name: 'USB-хаб Anker 7-in-1',    price: 3490,  createdAt: new Date() },
  { name: 'Веб-камера Logitech C920', price: 8990,  createdAt: new Date() },
  { name: 'SSD Samsung 1TB',         price: 7200,  createdAt: new Date() },
  { name: 'Оперативная память DDR5 16GB', price: 4800, createdAt: new Date() },
  { name: 'Коврик для мыши XL',      price: 1290,  createdAt: new Date() },
];

async function seed() {
  const client = new MongoClient(MONGO_URI);

  try {
    console.log('🔌 Подключаюсь к MongoDB...');
    await client.connect();
    console.log(`✅ Подключено к: ${DB_NAME}\n`);

    const db = client.db(DB_NAME);

    // ── Коллекция: products ───────────────────────────────────────────────────
    const productsCol = db.collection('products');

    // Создаём индексы
    await productsCol.createIndex({ name: 1 });
    await productsCol.createIndex({ price: 1 });
    await productsCol.createIndex({ createdAt: -1 });
    console.log('📑 Индексы коллекции "products" созданы');

    // Проверяем, есть ли уже данные
    const existing = await productsCol.countDocuments();
    if (existing > 0) {
      console.log(`⚠️  В коллекции "products" уже есть ${existing} записей.`);
      console.log('   Используй --force чтобы пересоздать данные.\n');

      if (!process.argv.includes('--force')) {
        console.log('ℹ️  Запусти с флагом: node seed.js --force');
        return;
      }

      // --force: очищаем и заново заполняем
      await productsCol.deleteMany({});
      console.log('🗑️  Старые данные удалены (--force)');
    }

    // Вставляем тестовые товары
    const result = await productsCol.insertMany(SEED_PRODUCTS);
    console.log(`✅ Вставлено ${result.insertedCount} товаров в "products"\n`);

    // ── Коллекция: categories (справочник) ────────────────────────────────────
    const categoriesCol = db.collection('categories');
    await categoriesCol.createIndex({ slug: 1 }, { unique: true });

    const catCount = await categoriesCol.countDocuments();
    if (catCount === 0) {
      await categoriesCol.insertMany([
        { slug: 'electronics',  label: 'Электроника',   createdAt: new Date() },
        { slug: 'peripherals',  label: 'Периферия',     createdAt: new Date() },
        { slug: 'accessories',  label: 'Аксессуары',    createdAt: new Date() },
        { slug: 'components',   label: 'Комплектующие', createdAt: new Date() },
      ]);
      console.log('✅ Коллекция "categories" заполнена (4 записи)');
    } else {
      console.log(`ℹ️  Коллекция "categories" уже содержит ${catCount} записей, пропускаю`);
    }

    // ── Коллекция: logs (пустая, только индекс) ───────────────────────────────
    const collections = await db.listCollections({ name: 'logs' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('logs');
      await db.collection('logs').createIndex({ timestamp: -1 });
      console.log('✅ Коллекция "logs" создана');
    } else {
      console.log('ℹ️  Коллекция "logs" уже существует, пропускаю');
    }

    // ── Итог ──────────────────────────────────────────────────────────────────
    console.log('\n📦 Итог — коллекции в базе', DB_NAME, ':');
    const allCols = await db.listCollections().toArray();
    for (const col of allCols) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`   • ${col.name.padEnd(16)} — ${count} документов`);
    }

    console.log('\n🎉 Seed выполнен успешно!');

  } catch (err) {
    console.error('\n❌ Ошибка seed:', err.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Соединение закрыто');
  }
}

seed();
