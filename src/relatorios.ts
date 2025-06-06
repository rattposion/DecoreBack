import { VercelRequest, VercelResponse } from '@vercel/node';
import handler from './reports.js';

export default async function (req: VercelRequest, res: VercelResponse) {
  return handler(req, res);
} 