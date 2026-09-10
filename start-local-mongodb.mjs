import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import net from 'net';

const dbPath = 'C:\\Program Files\\MongoDB\\Server\\8.2\\data';
const mongodExe = 'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe';
const lockFile = path.join(dbPath, 'mongod.lock');
const diagDir = path.join(dbPath, 'diagnostic.data');

function checkPort() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(27017, '127.0.0.1');
  });
}

async function main() {
  console.log('1. Checking port 27017...');
  if (await checkPort()) {
    console.log('✅ Local MongoDB is ALREADY running and accepting connections on 127.0.0.1:27017!');
    return;
  }

  console.log('2. Cleaning stale lock and corrupted diagnostic files...');
  try {
    if (fs.existsSync(lockFile)) fs.writeFileSync(lockFile, '');
    if (fs.existsSync(diagDir)) {
      const files = fs.readdirSync(diagDir);
      for (const file of files) {
        if (file.includes('interim')) {
          try { fs.unlinkSync(path.join(diagDir, file)); } catch {}
        }
      }
    }
  } catch (e) {
    console.warn('Note:', e.message);
  }

  console.log('3. Starting MongoDB service or direct process...');
  try {
    execSync('net start MongoDB', { stdio: 'pipe' });
  } catch {
    // If Windows service start fails or needs admin, launch mongod.exe directly with --noFTDC
    const child = spawn(mongodExe, ['--dbpath', dbPath, '--bind_ip', '127.0.0.1', '--port', '27017', '--noFTDC'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  }

  console.log('4. Waiting for MongoDB on 127.0.0.1:27017...');
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await checkPort()) {
      console.log('✅ Local MongoDB successfully started and listening on 127.0.0.1:27017!');
      return;
    }
  }

  console.error('❌ Failed to start. Run fix-local-mongo-service.bat as Administrator.');
  process.exit(1);
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
