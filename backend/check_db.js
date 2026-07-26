import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'db', 'skillslab.db');
console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath);
  const users = db.prepare('SELECT id, email, name FROM users').all();
  console.log('Users in local DB:', users);
} catch (err) {
  console.error('Error querying DB:', err.message);
}
