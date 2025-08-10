
# Cloud-debbugable Stability AI Render Server

## Quick Start (Local)
1) Ensure Node.js 18+
2) `npm install`
3) Copy `.env.example` -> `.env` and put your Stability key
4) `npm start`
5) Open http://localhost:10000  (HTML test page)
6) Click "开始渲染" to test; upload a room image for image-to-image

## Deploy to Render.com
- Create a Web Service
- Build Command: `npm install`
- Start Command: `npm start`
- Add env var `STABILITY_API_KEY=<your key>`
- After deploy, open the URL and you can test directly in the browser.
