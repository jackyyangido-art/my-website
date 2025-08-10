
/**
 * Cloud-debuggable demo server for Stability AI
 * Endpoints:
 *  - GET  /health
 *  - POST /render (multipart/form-data)
 *      fields:
 *        prompt (string, optional if roomImage provided)
 *        roomImage (file, optional – if provided we use image-to-image edit)
 *        strength (string, default "0.45")
 *  Response: { imageUrl } (PNG served by this server) or { error }
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
const RESULTS_DIR = path.join(__dirname, 'results');

app.use(morgan('dev'));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/results', express.static(RESULTS_DIR));

const upload = multer({ dest: 'uploads/' });

app.get('/health', (req, res) => {
  res.json({ ok: true, provider: 'stability', time: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/render', upload.single('roomImage'), async (req, res) => {
  try {
    const API_KEY = process.env.STABILITY_API_KEY;
    if (!API_KEY) {
      return res.status(400).json({ error: 'Missing STABILITY_API_KEY in environment' });
    }
    const strength = req.body.strength || '0.45';
    const prompt = req.body.prompt || 'modern interior, soft natural side light, photorealistic';

    // If a room image is uploaded, use image-to-image edit endpoint
    if (req.file) {
      const engine = process.env.STABILITY_ENGINE || 'core';
      const url = `https://api.stability.ai/v2beta/stable-image/edit/${engine}`;
      const form = new FormData();
      form.append('prompt', prompt);
      form.append('output_format', 'png');
      form.append('strength', strength);
      form.append('mode', 'image-to-image');
      form.append('image', fs.createReadStream(req.file.path));

      const resp = await axios.post(url, form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${API_KEY}`
        },
        responseType: 'arraybuffer',
        timeout: 120000
      });

      if (resp.status >= 400) {
        return res.status(resp.status).send(resp.data.toString());
      }
      const filename = `render_${Date.now()}.png`;
      const outPath = path.join(RESULTS_DIR, filename);
      fs.writeFileSync(outPath, Buffer.from(resp.data), 'binary');
      return res.json({ imageUrl: `/results/${filename}` });
    } else {
      // Otherwise use text-to-image generate endpoint
      const url = `https://api.stability.ai/v2beta/stable-image/generate/core`;
      const body = {
        prompt,
        output_format: 'png',
        width: 1024,
        height: 768
      };
      const resp = await axios.post(url, body, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 120000
      });
      if (resp.status >= 400) {
        return res.status(resp.status).send(resp.data);
      }
      const base64 = resp.data.image; // API returns base64 PNG in JSON
      const filename = `render_${Date.now()}.png`;
      const outPath = path.join(RESULTS_DIR, filename);
      fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
      return res.json({ imageUrl: `/results/${filename}` });
    }
  } catch (err) {
    console.error(err.response?.data || err.message);
    return res.status(500).json({ error: 'Render failed', detail: err.response?.data || err.message });
  } finally {
    // cleanup temp upload
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
