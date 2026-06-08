import express from 'express';
import cors from 'cors';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import cipherRoutes from './routes/ciphers.js';
import mediaRoutes from './routes/media.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/openapi.yaml', (_req, res) => {
  const spec = path.join(__dir, '../../docs/openapi.yaml');
  res.type('text/yaml').send(readFileSync(spec, 'utf8'));
});

app.use('/api/ciphers', cipherRoutes);
app.use('/api/media', mediaRoutes);

if (process.env.SERVE_FRONTEND === '1') {
  const dist = path.join(__dir, '../../frontend/dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`Cipher Toolkit API → http://${HOST}:${PORT}`);
});
