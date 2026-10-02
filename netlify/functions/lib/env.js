const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Configure Node to use Google/Cloudflare DNS so SRV records for MongoDB Atlas resolve reliably
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key] && val) {
          process.env[key] = val;
        }
      }
    }
  } catch (e) {
    // Ignore file read error
  }
}

// Try multiple candidate paths for .env
loadEnvFile(path.resolve(__dirname, '../../../.env'));
loadEnvFile(path.resolve(__dirname, '../../client/.env'));
loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), 'client/.env'));

// Hardcoded fallback for local development so it NEVER fails with undefined MONGODB_URI
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb+srv://desmonddecker684_db_user:PrFX02DIqQ0JYGYi@cluster0.k5zthxk.mongodb.net/dominion-city?retryWrites=true&w=majority&appName=Cluster0';
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dev-secret-change-before-production';
}

module.exports = {
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
};

