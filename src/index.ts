import express from 'express';
import dotenv from 'dotenv';
import instagramWebhooks from './routes/instagram';
import oauthRoutes from './routes/oauth';

dotenv.config();

if (process.env.DATABASE_URL && !process.env.DB_URL) {
  process.env.DB_URL = process.env.DATABASE_URL;
}

const app = express();

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/webhooks/instagram', instagramWebhooks);
app.use(oauthRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Webhook listener running on port ${PORT}`);
});
