# Step-by-Step Deployment Guide for Triple Mindes

Follow these steps to deploy both your API server and admin panel to Vercel!

---

## Prerequisites
1. A GitHub, GitLab, or Bitbucket account
2. A Vercel account (sign up for free at https://vercel.com)
3. A MongoDB Atlas account (free tier works great)

---

## Step 1: Set Up MongoDB Atlas (Required)
1. Go to https://www.mongodb.com/atlas and create an account
2. Create a new project (call it "Triple Mindes")
3. Create a free cluster:
   - Choose "M0 Sandbox" (free forever)
   - Select your preferred cloud provider and region
   - Click "Create Cluster"
4. Wait for your cluster to be created (takes 1-3 minutes)
5. Click "Connect" → "Connect your application"
6. Copy your connection string (looks like: `mongodb+srv://<username>:<password>@cluster0...`)
7. Save this connection string—we'll need it soon!

---

## Step 2: Push Your Code to GitHub/GitLab
1. Create a new repository on GitHub/GitLab/Bitbucket
2. Add the remote to your local repo:
   ```bash
   git remote add origin <your-repository-url>
   git push -u origin master
   ```
3. Your code should now be on GitHub!

---

## Step 3: Deploy the API Server to Vercel
1. Go to https://vercel.com/new
2. Import your repository
3. Configure the project:
   - **Project Name**: triple-mindes-api
   - **Framework Preset**: Other
   - **Root Directory**: `api-server` (click "Edit" and set this)
4. Add Environment Variables (click "Environment Variables"):
   - `JWT_SECRET`: A strong random string (generate one at https://jwtsecret.com)
   - `MONGODB_URI`: Your MongoDB Atlas connection string from Step 1
5. Click "Deploy" and wait for Vercel to finish!

Once deployed, you'll get a URL like `https://triple-mindes-api.vercel.app`—this is your API base URL!

---

## Step 4: Deploy the Admin Panel to Vercel
1. Go back to https://vercel.com/new
2. Import your repository again
3. Configure this project:
   - **Project Name**: triple-mindes-admin
   - **Framework Preset**: Vite
   - **Root Directory**: `admin-panel`
4. Add Environment Variable:
   - `VITE_API_URL`: Your deployed API URL from Step 3 (e.g., `https://triple-mindes-api.vercel.app`)
5. Click "Deploy"!

---

## Step 5: Verify the Deployment!

### Test the API Health
Visit your API URL at: `https://[your-api-domain].vercel.app/api/health`
You should see: `{"status":"ok"}`

### Login to Admin Panel
1. Open your admin panel URL (something like `https://triple-mindes-admin.vercel.app`)
2. Log in with:
   - **Email**: `admin@streamvault.com`
   - **Password**: `admin123`

---

## Your API Endpoints

All API endpoints are prefixed with `/api`!

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `GET /api/auth/me` - Get current admin user

### Content & Media
- `GET /api/categories` - List categories
- `GET /api/categories/with-content` - Categories with content
- `GET /api/categories/:categoryId/contents` - Contents in a category
- `GET /api/contents` - List all content (shows, movies)
- `GET /api/contents/:id` - Get single content item
- `GET /api/banners` - List banners
- `GET /api/banners/item/:bannerId` - Get banner details
- `GET /api/ads` - List ads

### Pages
- `GET /api/pages` - List pages (Privacy Policy, Terms, etc.)
- `GET /api/pages/:slug` - Get single page by slug

### Users
- `GET /api/users` - List users (admin only)
- `GET /api/users/:id` - Get user details (admin only)
- `PATCH /api/users/:id` - Update user (admin only)

---

## Environment Variables Recap

### API Server Environment Variables
| Name | Description | Example |
|------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:password@cluster0...` |
| `JWT_SECRET` | Strong secret for JWT tokens | `my-super-secret-key-12345` |
| `REDIS_URL` | (Optional) Redis connection string | `rediss://default:password@...` |

### Admin Panel Environment Variables
| Name | Description | Example |
|------|-------------|---------|
| `VITE_API_URL` | Your API base URL | `https://triple-mindes-api.vercel.app` |

---

## Troubleshooting
- **API returning 500**: Make sure your `MONGODB_URI` is correct and your IP is whitelisted in MongoDB Atlas!
- **Admin panel not connecting to API**: Double-check your `VITE_API_URL` environment variable!
- **Can't log in**: Make sure your API is deployed successfully!

---

## Next Steps
1. Update your admin credentials in the API server (or via admin panel settings)
2. Add your own content, categories, and banners!
3. Customize the branding (logo, colors) via the admin panel's Branding page!
