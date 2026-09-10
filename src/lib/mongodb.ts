import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import net from 'net';

async function ensureLocalMongoRunning(): Promise<void> {
  const dbPath = 'C:\\Program Files\\MongoDB\\Server\\8.2\\data';
  const mongodExe = 'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe';
  const lockFile = path.join(dbPath, 'mongod.lock');
  const diagDir = path.join(dbPath, 'diagnostic.data');

  const check = () => new Promise<boolean>((resolve) => {
    const s = new net.Socket();
    s.setTimeout(800);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.connect(27017, '127.0.0.1');
  });

  if (await check()) return;

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

  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await check()) break;
  }
}

export async function connectMongoDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set — cannot start server without database');
  }
  if (uri.includes('localhost') || uri.includes('127.0.0.1')) {
    logger.info('MONGODB_URI points to localhost, attempting connection...');
    await ensureLocalMongoRunning();
  }
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    logger.info({ dbName: mongoose.connection.name }, 'MongoDB connected');

    mongoose.connection.on('error', (err: unknown) => {
      logger.error({ err }, 'MongoDB connection error');
    });
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connection established');
    });
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB connection re-established');
    });
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
  } catch (err) {
    logger.error({ err }, 'MongoDB connection failed');
    throw err;
  }
}
