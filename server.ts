import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('pidm.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    module TEXT NOT NULL,
    icon TEXT,
    custom_fields TEXT,
    FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    FOREIGN KEY (parent_id) REFERENCES locations (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    purchase_date TEXT,
    price REAL,
    location_id TEXT,
    notes TEXT,
    metadata TEXT,
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    payment_method TEXT,
    vendor TEXT,
    notes TEXT,
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
  );
`);

// Seed initial categories if empty
const categoryCount = db.prepare('SELECT count(*) as count FROM categories').get() as { count: number };
if (categoryCount.count === 0) {
  const insertCategory = db.prepare('INSERT INTO categories (id, name, parent_id, module, icon) VALUES (?, ?, ?, ?, ?)');
  
  // Physical Inventory
  insertCategory.run('inv-root', 'Inventory', null, 'inventory', 'Package');
  insertCategory.run('inv-elec', 'Electronics', 'inv-root', 'inventory', 'Cpu');
  insertCategory.run('inv-comp', 'Computers', 'inv-elec', 'inventory', 'Monitor');
  insertCategory.run('inv-laptop', 'Laptops', 'inv-comp', 'inventory', 'Laptop');
  insertCategory.run('inv-desktop', 'Desktops', 'inv-comp', 'inventory', 'Pc');
  insertCategory.run('inv-phone', 'Phones', 'inv-elec', 'inventory', 'Smartphone');
  insertCategory.run('inv-acc', 'Accessories', 'inv-elec', 'inventory', 'Headphones');
  
  insertCategory.run('inv-books', 'Books', 'inv-root', 'inventory', 'Book');
  insertCategory.run('inv-classics', 'Classics', 'inv-books', 'inventory', 'Library');
  insertCategory.run('inv-rus-classics', 'Russian Classics', 'inv-classics', 'inventory', 'Scroll');
  insertCategory.run('inv-bri-classics', 'British Classics', 'inv-classics', 'inventory', 'Scroll');
  insertCategory.run('inv-mystery', 'Mystery', 'inv-books', 'inventory', 'Search');
  insertCategory.run('inv-historical', 'Historical', 'inv-books', 'inventory', 'History');
  insertCategory.run('inv-nonfiction', 'Non-fiction', 'inv-books', 'inventory', 'Info');
  
  insertCategory.run('inv-furniture', 'Furniture', 'inv-root', 'inventory', 'Sofa');
  insertCategory.run('inv-appliances', 'Appliances', 'inv-root', 'inventory', 'Zap');
  insertCategory.run('inv-clothing', 'Clothing', 'inv-root', 'inventory', 'Shirt');
  insertCategory.run('inv-kitchen', 'Kitchen Items', 'inv-root', 'inventory', 'Utensils');
  insertCategory.run('inv-tools', 'Tools', 'inv-root', 'inventory', 'Wrench');
  insertCategory.run('inv-vehicles', 'Vehicles', 'inv-root', 'inventory', 'Car');
  
  // Document Vault
  insertCategory.run('doc-root', 'Documents', null, 'documents', 'FileText');
  insertCategory.run('doc-id', 'Identity', 'doc-root', 'documents', 'User');
  insertCategory.run('doc-passport', 'Passport', 'doc-id', 'documents', 'Globe');
  insertCategory.run('doc-aadhaar', 'Aadhaar', 'doc-id', 'documents', 'Fingerprint');
  insertCategory.run('doc-pan', 'PAN', 'doc-id', 'documents', 'IdCard');
  
  insertCategory.run('doc-fin', 'Financial', 'doc-root', 'documents', 'DollarSign');
  insertCategory.run('doc-bank', 'Bank Accounts', 'doc-fin', 'documents', 'Building');
  insertCategory.run('doc-ins', 'Insurance', 'doc-fin', 'documents', 'Shield');
  insertCategory.run('doc-tax', 'Tax', 'doc-fin', 'documents', 'FileDigit');
  
  insertCategory.run('doc-med', 'Medical', 'doc-root', 'documents', 'Activity');
  insertCategory.run('doc-pres', 'Prescriptions', 'doc-med', 'documents', 'Pill');
  insertCategory.run('doc-reports', 'Reports', 'doc-med', 'documents', 'Clipboard');
  
  insertCategory.run('doc-prop', 'Property', 'doc-root', 'documents', 'Home');
  
  // Grocery Inventory
  insertCategory.run('gro-root', 'Groceries', null, 'groceries', 'ShoppingCart');
  insertCategory.run('gro-grains', 'Grains', 'gro-root', 'groceries', 'Wheat');
  insertCategory.run('gro-rice', 'Rice', 'gro-grains', 'groceries', 'Circle');
  insertCategory.run('gro-wheat', 'Wheat', 'gro-grains', 'groceries', 'Wheat');
  
  insertCategory.run('gro-veg', 'Vegetables', 'gro-root', 'groceries', 'Leaf');
  insertCategory.run('gro-leafy', 'Leafy', 'gro-veg', 'groceries', 'Leaf');
  insertCategory.run('gro-root-veg', 'Root', 'gro-veg', 'groceries', 'Carrot');
  
  insertCategory.run('gro-dairy', 'Dairy', 'gro-root', 'groceries', 'Milk');
  insertCategory.run('gro-milk', 'Milk', 'gro-dairy', 'groceries', 'Milk');
  insertCategory.run('gro-cheese', 'Cheese', 'gro-dairy', 'groceries', 'Pizza');
  insertCategory.run('gro-butter', 'Butter', 'gro-dairy', 'groceries', 'Square');
  
  insertCategory.run('gro-snacks', 'Snacks', 'gro-root', 'groceries', 'Cookie');
  
  // Digital Assets
  insertCategory.run('dig-root', 'Digital Assets', null, 'digital', 'Globe');
  insertCategory.run('dig-soft', 'Software', 'dig-root', 'digital', 'Code');
  insertCategory.run('dig-sub', 'Subscriptions', 'dig-root', 'digital', 'RefreshCw');
  insertCategory.run('dig-dom', 'Domains', 'dig-root', 'digital', 'Link');
  insertCategory.run('dig-lic', 'Licenses', 'dig-root', 'digital', 'Key');
  
  // Expense Tracker
  insertCategory.run('exp-root', 'Expenses', null, 'expenses', 'CreditCard');
  insertCategory.run('exp-house', 'Household', 'exp-root', 'expenses', 'Home');
  insertCategory.run('exp-gro', 'Groceries', 'exp-house', 'expenses', 'ShoppingCart');
  insertCategory.run('exp-util', 'Utilities', 'exp-house', 'expenses', 'Zap');
  insertCategory.run('exp-maint', 'Maintenance', 'exp-house', 'expenses', 'Tool');
  
  insertCategory.run('exp-trans', 'Transportation', 'exp-root', 'expenses', 'Bus');
  insertCategory.run('exp-sub', 'Subscriptions', 'exp-root', 'expenses', 'RefreshCw');
  insertCategory.run('exp-misc', 'Miscellaneous', 'exp-root', 'expenses', 'MoreHorizontal');

  // Locations
  const insertLocation = db.prepare('INSERT INTO locations (id, name, parent_id) VALUES (?, ?, ?)');
  insertLocation.run('loc-home', 'Home', null);
  insertLocation.run('loc-kitchen', 'Kitchen', 'loc-home');
  insertLocation.run('loc-pantry', 'Pantry', 'loc-kitchen');
  insertLocation.run('loc-fridge', 'Refrigerator', 'loc-kitchen');
  insertLocation.run('loc-bedroom', 'Bedroom', 'loc-home');
  insertLocation.run('loc-wardrobe', 'Wardrobe', 'loc-bedroom');
  insertLocation.run('loc-drawer', 'Drawer', 'loc-bedroom');
  insertLocation.run('loc-study', 'Study', 'loc-home');

  // Sample Items
  const insertItem = db.prepare('INSERT INTO items (id, category_id, name, brand, purchase_date, price, notes, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertItem.run('item-1', 'inv-laptop', 'MacBook Pro 14"', 'Apple', '2023-10-15', 1999.99, 'Work laptop', 'loc-study');
  insertItem.run('item-2', 'inv-rus-classics', 'War and Peace', 'Leo Tolstoy', '2024-01-05', 25.50, 'Hardcover edition', 'loc-study');
  insertItem.run('item-3', 'gro-milk', 'Organic Milk', 'Local Farm', '2026-03-10', 4.99, 'Exp 2026-03-20', 'loc-fridge');
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get('/api/categories', (req, res) => {
    const categories = db.prepare('SELECT * FROM categories').all();
    res.json(categories);
  });

  app.post('/api/categories', (req, res) => {
    const { id, name, parent_id, module, icon, custom_fields } = req.body;
    db.prepare('INSERT INTO categories (id, name, parent_id, module, icon, custom_fields) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name, parent_id, module, icon, JSON.stringify(custom_fields));
    res.status(201).json({ id });
  });

  app.get('/api/items', (req, res) => {
    const { categoryId } = req.query;
    let items;
    if (categoryId) {
      items = db.prepare('SELECT * FROM items WHERE category_id = ?').all(categoryId);
    } else {
      items = db.prepare('SELECT * FROM items').all();
    }
    res.json(items);
  });

  app.post('/api/items', (req, res) => {
    const { id, category_id, name, brand, purchase_date, price, location_id, notes, metadata } = req.body;
    db.prepare('INSERT INTO items (id, category_id, name, brand, purchase_date, price, location_id, notes, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, category_id, name, brand, purchase_date, price, location_id, notes, JSON.stringify(metadata));
    res.status(201).json({ id });
  });

  app.get('/api/locations', (req, res) => {
    const locations = db.prepare('SELECT * FROM locations').all();
    res.json(locations);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
  });
}

startServer();
