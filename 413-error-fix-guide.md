
# Fix 413 Request Entity Too Large Error on Live Server

## Domain
https://ott.kotiboxglobaltech.site

## Problem
When uploading large files (videos, images), you get:
```
413 Request Entity Too Large
nginx/1.24.0 (Ubuntu)
```

## Solution
We need to update **both Nginx** and make sure our Fastify server limits are set correctly (which they are already).

---

## Step 1: Update Fastify Server Limits (Already Done ✅)
Our Fastify server already has the correct limits set at **2GB**:
- `bodyLimit: 2000 * 1024 * 1024` (in `app.ts` line 16)
- `fileSize: 2000 * 1024 * 1024` (in `app.ts` line 39)

---

## Step 2: Update Nginx Configuration on Live Server

### 2.1: Upload the Nginx Config File
1. Transfer `nginx-production.conf` from your local machine to the live server
2. Save it as: `/etc/nginx/sites-available/triple-minds`

### 2.2: Update Configuration Paths
1. Open the config file on your server:
   ```bash
   sudo nano /etc/nginx/sites-available/triple-minds
   ```
2. **Only need to update this placeholder**:
   - `/var/www/triple-minds/api-server/uploads/` → Absolute path to your actual `uploads` folder on the server

### 2.3: Enable the New Site
1. Remove any default nginx config (if needed):
   ```bash
   sudo rm /etc/nginx/sites-enabled/default
   ```
2. Enable your new site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/triple-minds /etc/nginx/sites-enabled/
   ```

### 2.4: Update Main Nginx Config
1. Open `/etc/nginx/nginx.conf`:
   ```bash
   sudo nano /etc/nginx/nginx.conf
   ```
2. **Add** this line **inside** the `http` block (before the closing `}`):
   ```nginx
   client_max_body_size 2G;
   ```

### 2.5: Test & Reload Nginx
1. Test that your config has no errors:
   ```bash
   sudo nginx -t
   ```
2. If it says "syntax is ok" & "test is successful", reload nginx:
   ```bash
   sudo systemctl reload nginx
   ```

---

## Step 3: Verify the Fix
1. Try uploading a large file (e.g., 500MB video) through your app/admin panel at https://ott.kotiboxglobaltech.site
2. It should work without any `413 Request Entity Too Large` error!

---

## Optional: SSL Certificate with Let's Encrypt (If Not Already Setup)
To enable HTTPS and get free SSL certificates:
1. Install Certbot:
   ```bash
   sudo apt update && sudo apt install certbot python3-certbot-nginx -y
   ```
2. Get and install certificates:
   ```bash
   sudo certbot --nginx -d ott.kotiboxglobaltech.site -d www.ott.kotiboxglobaltech.site
   ```
3. Follow Certbot's prompts! It will automatically update your nginx config with SSL settings!
4. Certbot will also set up auto‑renewal!

---

## Optional: PM2 for Process Management (Keep API Server Running)
To ensure your Fastify server restarts if it crashes or the server reboots:
1. Install PM2:
   ```bash
   npm install -g pm2
   ```
2. Build the API server:
   ```bash
   cd /path/to/api-server && npm run build
   ```
3. Start the server with PM2:
   ```bash
   pm2 start dist/index.mjs --name triple-minds-api
   ```
4. Set PM2 to start on boot:
   ```bash
   pm2 startup
   pm2 save
   ```

---

## Quick Recap of What Changed
- **Nginx**: Increased `client_max_body_size` to 2GB (this is the main fix!)
- **Fastify**: Already set to accept files up to 2GB
- **Timeouts**: Increased nginx/Fastify timeouts for large uploads

This fix will handle all large file uploads perfectly!
