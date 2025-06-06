import { VercelRequest, VercelResponse } from '@vercel/node';
import handler from './reports';

export default async function (req: VercelRequest, res: VercelResponse) {
  return handler(req, res);
} 