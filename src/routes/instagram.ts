import { Router, Request, Response } from 'express';
import { captureRawBody, RawBodyRequest } from '../middleware/rawBody';
import { verifyMetaSignature } from '../middleware/verifySignature';
import { processInboundMessages } from '../webhooks/instagram/handler';
import { parseInstagramWebhook } from '../webhooks/instagram/parse';
import { InstagramWebhookPayload } from '../webhooks/instagram/types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (
    mode === 'subscribe' &&
    typeof token === 'string' &&
    verifyToken &&
    token === verifyToken &&
    challenge !== undefined
  ) {
    res.status(200).type('text/plain').send(String(challenge));
    return;
  }

  res.sendStatus(403);
});

router.post(
  '/',
  captureRawBody,
  verifyMetaSignature,
  async (req: RawBodyRequest, res: Response): Promise<void> => {
    try {
      if (!req.rawBody) {
        res.sendStatus(400);
        return;
      }

      const payload = JSON.parse(
        req.rawBody.toString('utf8'),
      ) as InstagramWebhookPayload;

      if (payload.object !== 'instagram') {
        res.sendStatus(200);
        return;
      }

      const inbound = parseInstagramWebhook(payload);
      await processInboundMessages(inbound);

      res.sendStatus(200);
    } catch (error) {
      console.error('Instagram webhook error:', error);
      res.sendStatus(500);
    }
  },
);

export default router;
