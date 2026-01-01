# 🚀 Deployment Guide - LinkUp Messaging App

## Quick Deploy Options

### Option 1: Vercel (Frontend) + Render (Backend) - **RECOMMENDED**
**Best for**: Easy setup, free tier available, automatic deployments

#### Frontend (Vercel):
1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `cd apps/web && vercel`
3. Follow prompts, set build command: `npm run build`
4. Set output directory: `dist`

#### Backend (Render):
1. Go to https://render.com
2. Create new "Web Service"
3. Connect your GitHub repo
4. Settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Add environment variables from `.env`

---

### Option 2: Railway (Full Stack)
**Best for**: One-click deployment, handles both frontend and backend

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub"
3. Select your repo
4. Railway will auto-detect the monorepo
5. Add environment variables
6. Deploy!

---

### Option 3: DigitalOcean App Platform
**Best for**: More control, scalable

1. Go to https://cloud.digitalocean.com/apps
2. Create new app from GitHub
3. Configure:
   - **Web Service** (Backend): `apps/server`
   - **Static Site** (Frontend): `apps/web`
4. Add environment variables
5. Deploy

---

## Environment Variables Needed

### Backend (.env):
```bash
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://postgres:AlbinAntony1233!@db.vkdhylmfplwjzvefmhgf.supabase.co:5432/postgres
REDIS_URL=redis://your-redis-url:6379
JWT_ACCESS_SECRET=dev-secret-key-at-least-32-chars-long-123
JWT_REFRESH_SECRET=dev-refresh-secret-key-at-least-32-chars-long-456
SUPABASE_URL=https://vkdhylmfplwjzvefmhgf.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZGh5bG1mcGx3anp2ZWZtaGdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTU2MjQ3MCwiZXhwIjoyMDUxMTM4NDcwfQ.xLPQxYcZmVNlPWKEMxHNpNcpRJsJKPPPJbOmMwvxPXU
STORAGE_BUCKET=chat-images
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

### Frontend (Vercel/Netlify):
```bash
VITE_API_BASE_URL=https://your-backend-domain.onrender.com
```

---

## Pre-Deployment Checklist

- [x] Database migrated (Supabase PostgreSQL)
- [x] Test users seeded
- [x] Build successful locally
- [ ] Update CORS_ORIGIN with your frontend URL
- [ ] Deploy Redis (Upstash free tier recommended)
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Update frontend API URL

---

## Redis Setup (Required for Real-time Features)

### Upstash (Free Tier - RECOMMENDED):
1. Go to https://upstash.com
2. Create new Redis database
3. Copy the connection URL
4. Add to backend env: `REDIS_URL=redis://...`

---

## Post-Deployment

1. Test login with: `alice@example.com` / `password`
2. Check WebSocket connection in browser console
3. Test image uploads
4. Verify real-time messaging between users

---

## Need Help?
- Check logs in your hosting platform dashboard
- Ensure all environment variables are set correctly
- Verify database connection string
