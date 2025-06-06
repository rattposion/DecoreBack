import { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient } from 'mongodb';
import { ReportData } from './types';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://decore:Wesley26.@decore.xvhk00w.mongodb.net/decore_db?retryWrites=true&w=majority";
let cachedDb: MongoClient | null = null;

async function connectToDatabase(): Promise<MongoClient> {
  if (cachedDb) {
    return cachedDb;
  }

  const client = await MongoClient.connect(MONGODB_URI);
  cachedDb = client;
  return client;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    const { method, query, body } = request;
    
    // Configuração do CORS
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Responde à requisição OPTIONS do CORS
    if (method === 'OPTIONS') {
      return response.status(200).end();
    }

    const client = await connectToDatabase();
    const collection = client.db('decore_db').collection<ReportData>('relatorios');

    switch (method) {
      case 'GET':
        if (query.date) {
          const report = await collection.findOne({ 'header.date': query.date });
          if (!report) {
            return response.status(404).json({ error: 'Relatório não encontrado' });
          }
          return response.json(report);
        } else {
          const reports = await collection.find({}).toArray();
          return response.json(reports);
        }

      case 'POST':
        if (!body || !body.header || !body.header.date) {
          return response.status(400).json({ error: 'Dados do relatório inválidos' });
        }
        const result = await collection.insertOne(body as ReportData);
        return response.status(201).json(result);

      case 'PUT':
        if (!query.date) {
          return response.status(400).json({ error: 'Data é obrigatória' });
        }
        if (!body || !body.header || !body.header.date) {
          return response.status(400).json({ error: 'Dados do relatório inválidos' });
        }
        const updateResult = await collection.updateOne(
          { 'header.date': query.date },
          { $set: body as ReportData },
          { upsert: true }
        );
        return response.json(updateResult);

      default:
        response.setHeader('Allow', ['GET', 'POST', 'PUT', 'OPTIONS']);
        return response.status(405).json({ error: `Método ${method} não permitido` });
    }
  } catch (error) {
    console.error('Erro no banco de dados:', error);
    return response.status(500).json({ error: 'Erro interno do servidor' });
  }
} 