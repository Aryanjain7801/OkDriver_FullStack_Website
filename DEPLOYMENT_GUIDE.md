# Complete Web & Backend Deployment Guide (Step-by-Step)

This guide explains how to deploy this full-stack CCTV platform (or any Node.js + Python/Django application) to cloud hosting services (Render/Vercel) and expose local instances for testing.

---

## 1. Architecture Overview
- **Frontend & Real-time Server**: Node.js / Express (Port `3000`)
- **Authentication & Database**: Python / Django (Port `8000`)
- **Public URL Exposition**: Localtunnel / Ngrok / Render

---

## 2. Option A: Local Exposition using Localtunnel (Fastest & Free)

If your website is running locally on your computer and you want to share a live HTTPS URL instantly:

1. **Install Localtunnel**:
   ```bash
   npm install -g localtunnel
   ```

2. **Start your local backend / frontend**:
   ```bash
   # Terminal 1: Node.js Server
   node server.js

   # Terminal 2: Django Server
   python manage.py runserver 0.0.0.0:8000
   ```

3. **Expose your local port publicly**:
   ```bash
   npx localtunnel --port 3000
   ```
   *Output will give you a public URL like `https://okdriver-cctv.loca.lt`.*

---

## 3. Option B: Deploying to Cloud (Render.com)

Render supports free automatic hosting for Node.js, Python, and Docker applications directly from GitHub.

### Step 1: Push Project to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2: Deploy on Render
1. Go to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Set the following settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
5. Click **Create Web Service**. Your app will be live on a `*.onrender.com` URL!

---

## 4. Option C: Single-Container Deployment (Docker + Render Blueprint)

This repository includes a `docker-compose.yml` and `render.yaml` blueprint.

1. In Render, select **New +** -> **Blueprint**.
2. Connect your repo containing `render.yaml`.
3. Render automatically provisions the database, Django API, and Node.js web server.

---

## 5. Summary Checklist for Any New Website Deployment

1. **Check Environment Port**: Use `process.env.PORT || 3000` in code.
2. **Setup CORS**: Ensure backend permits origin from frontend domain.
3. **Set Start Scripts**: Define `"start": "node server.js"` in `package.json`.
4. **Push to GitHub**: Commit code without `node_modules` (`.gitignore`).
5. **Connect to Render/Vercel/Netlify**: Auto-deploy on every `git push`.
