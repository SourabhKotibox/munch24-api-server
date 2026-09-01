import fs from 'fs';
import path from 'path';

const ENV_PATH = path.resolve(process.cwd(), '.env');

export function updateEnvFile(updates: Record<string, string>): void {
  try {
    let content = '';
    try {
      content = fs.readFileSync(ENV_PATH, 'utf-8');
    } catch {
      // .env doesn't exist yet — start fresh
    }

    const lines = content.split('\n');

    for (const [key, value] of Object.entries(updates)) {
      const escaped = value.includes(' ') || value.includes('#') ? `"${value}"` : value;
      const idx = lines.findIndex((l) => l.startsWith(`${key}=`) || l.startsWith(`# ${key}=`));
      if (idx !== -1) {
        lines[idx] = `${key}=${escaped}`;
      } else {
        lines.push(`${key}=${escaped}`);
      }
      // Also apply immediately to the running process
      process.env[key] = value;
    }

    fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf-8');
  } catch (err) {
    console.error('Failed to update .env file:', err);
  }
}
