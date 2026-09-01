const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'src', 'models');

const modelsToAudit = [
  'Content.ts'
];

for (const file of modelsToAudit) {
  const filepath = path.join(MODELS_DIR, file);
  if (!fs.existsSync(filepath)) continue;

  let content = fs.readFileSync(filepath, 'utf8');

  // Skip if already applied
  if (content.includes('adminAuditPlugin')) {
    console.log(`Skipped ${file} (already applied)`);
    continue;
  }

  // Inject import
  content = `import { adminAuditPlugin } from '../middlewares/adminAuditPlugin';\n` + content;

  // Find the schema definition and inject the plugin
  // E.g., const MovieSchema = new Schema(...)
  // Usually, before export const MovieModel = mongoose.model...
  
  const modelRegex = /(export const [A-Za-z0-9]+Model\s*=\s*mongoose\.model.*?;)/s;
  const match = content.match(modelRegex);
  if (match) {
    // Find the schema name
    const schemaRegex = /mongoose\.model(?:<[A-Za-z]+>)?\s*\(\s*['"][A-Za-z]+['"]\s*,\s*([A-Za-z0-9]+Schema)\s*\)/;
    const schemaMatch = match[0].match(schemaRegex);
    if (schemaMatch && schemaMatch[1]) {
      const schemaName = schemaMatch[1];
      // Inject plugin before model export
      content = content.replace(match[0], `${schemaName}.plugin(adminAuditPlugin);\n${match[0]}`);
      fs.writeFileSync(filepath, content, 'utf8');
      console.log(`Applied plugin to ${file}`);
    } else {
      console.log(`Could not find schema name in ${file}`);
    }
  } else {
    console.log(`Could not find model export in ${file}`);
  }
}
