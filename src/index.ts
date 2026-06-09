import express from 'express';
import dotenv from 'dotenv';
import instagramWebhooks from './routes/instagram';
import oauthRoutes from './routes/oauth';
import appRoutes from './routes/app';
import { corsForWebApp } from './middleware/cors';
import { webAppBase } from './lib/publicUrl';

dotenv.config();

if (process.env.DATABASE_URL && !process.env.DB_URL) {
  process.env.DB_URL = process.env.DATABASE_URL;
}

const app = express();

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

// Webhooks must be registered before express.json/urlencoded — those parsers consume
// the request stream and leave captureRawBody with an empty body (signature → 401).
app.use('/webhooks/instagram', instagramWebhooks);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/api', corsForWebApp);

app.get('/', (_req, res) => {
  const web = webAppBase();
  if (web) {
    res.redirect(302, `${web}/inbox`);
    return;
  }
  res.redirect(302, '/inbox');
});

app.use(oauthRoutes);
app.use(appRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Webhook listener running on port ${PORT}`);
});
