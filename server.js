/**
 * Stability AI cloud-debug demo
 * GET /health
 * POST /render (multipart: roomImage? + prompt + strength)
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const morgan = require('morgan');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

const PUBLIC_DIR  = path.join(__dirname, 'public');
const RESULTS_DIR = path.join(__dirname, 'results');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// 确保目录存在
[PUBLIC_DIR, RESULTS_DIR, UPLOADS_DIR].forEach(p => fs.mkdirSync(p, { recursive: true }));

app.use(morgan('dev'));
app.use(cors());
app.use(express.static(PUBLIC_DIR));
app.use('/results', express.static(RESULTS_DIR));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.png';
      cb(null, `in_${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 } // 8MB
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, provider: 'stability', time: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.post('/render', upload.single('roomImage'), async (req, res) => {
  const API_KEY = process.env.STABILITY_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Missing STABILITY_API_KEY in environment' });
  }

  const engine   = process.env.STABILITY_ENGINE || 'core';
  const strength = String(req.body.strength || '0.45');
  const prompt   = (req.body.prompt || 'modern interior, soft natural side light, photorealistic').slice(0, 800);

  try {
    if (req.file) {
      // image-to-image（编辑）
      const url  = `https://api.stability.ai/v2beta/stable-image/edit/${engine}`;
      const form = new FormData();
      form.append('prompt', prompt);
      form.append('output_format', 'png');
      form.append('strength', strength);
      form.append('mode', 'image-to-image');
      form.append('image', fs.createReadStream(req.file.path));

      const resp = await axios.post(url, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${API_KEY}`,
          Accept: 'image/*'
        },
        responseType: 'arraybuffer',
        timeout: 120000
      });

      const filename = `render_${Date.now()}.png`;
      fs.writeFileSync(path.join(RESULTS_DIR, filename), Buffer.from(resp.data));
      return res.json({ imageUrl: `/results/${filename}` });

    } else {
      // text-to-image（生成）
      const url  = 'https://api.stability.ai/v2beta/stable-image/generate/core';
      const body = {
        prompt,
        output_format: 'png',
        width: 1024,
        height: 768
      };

      const resp = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 120000
      });

      const base64 = resp.data?.image;
      if (!base64) throw new Error('No image returned from Stability generate/core');

      const filename = `render_${Date.now()}.png`;
      fs.writeFileSync(path.join(RESULTS_DIR, filename), Buffer.from(base64, 'base64'));
      return res.json({ imageUrl: `/results/${filename}` });
    }
  } catch (err) {
    const status = err.response?.status;
    const data = typeof err.response?.data === 'string'
      ? err.response.data
      : JSON.stringify(err.response?.data || {});
    console.error('STABILITY ERROR:', status || '', data || err.message);
    return res.status(status || 500).json({
      error: 'Render failed',
      status,
      detail: data || err.message
    });
  } finally {
    if (req.file) fs.unlink(req.file.path, () => {});
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

/**
 * Cloud-debuggable demo server for Stability AI
 * Endpoints:
 *  - GET  /health
 *  - POST /render (multipart/form-data)
 *      fields:
 *        prompt (string, optional if roomImage provided)
 *        roomImage (file, optional – if provided, we use image-to-image edit)
 *        strength (string, default "0.45")
 *  Response: { imageUrl } (PNG served by this server) or { error }
 */



 
   
