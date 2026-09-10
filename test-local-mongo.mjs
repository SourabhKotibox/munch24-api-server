import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import net from 'net';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/triple-mindes';

async function checkPort() {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1000);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.connect(27017, '127.0.0.1');
  });
}

async function ensureMongo() {
  if (await checkPort()) return;
  console.log('MongoDB is not running on 127.0.0.1:27017. Auto-healing lock and starting process...');

  const dbPath = 'C:\\Program Files\\MongoDB\\Server\\8.2\\data';
  const mongodExe = 'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe';
  const lockFile = path.join(dbPath, 'mongod.lock');
  const diagDir = path.join(dbPath, 'diagnostic.data');

  try {
    if (fs.existsSync(lockFile)) fs.writeFileSync(lockFile, '');
    if (fs.existsSync(diagDir)) {
      for (const f of fs.readdirSync(diagDir)) {
        if (f.includes('interim')) {
          try { fs.unlinkSync(path.join(diagDir, f)); } catch {}
        }
      }
    }
  } catch {}

  try {
    execSync('net start MongoDB', { stdio: 'ignore' });
  } catch {
    if (fs.existsSync(mongodExe)) {
      const child = spawn(mongodExe, ['--dbpath', dbPath, '--bind_ip', '127.0.0.1', '--port', '27017', '--noFTDC'], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    }
  }

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await checkPort()) break;
  }
}

await ensureMongo();

console.log(`Connecting to local MongoDB at: ${uri}`);

try {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });
  console.log('✅ Successfully connected to local MongoDB!');
  const admin = mongoose.connection.db.admin();
  const ping = await admin.ping();
  console.log('Database Ping Response:', ping);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log(`Found ${collections.length} collections in triple-mindes database.`);
  await mongoose.disconnect();
  console.log('Disconnected cleanly.');
} catch (err) {
  console.error('❌ Connection error:', err.message);
  process.exit(1);
}
