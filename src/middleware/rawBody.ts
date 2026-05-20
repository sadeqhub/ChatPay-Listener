import { Request, Response, NextFunction } from 'express';

export interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

export function captureRawBody(
  req: RawBodyRequest,
  res: Response,
  next: NextFunction,
): void {
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });

  req.on('error', () => {
    res.sendStatus(400);
  });
}
