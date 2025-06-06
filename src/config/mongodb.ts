import { MongoClient, MongoClientOptions, ServerApiVersion } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

// Configurações do MongoDB do Railway - usando conexão interna
const MONGODB_URL = 'mongodb://mongo:GSxIXvNciEpMYKCHMrAQIzrcHIwnfGJC@mongodb.railway.internal:27017/decore_db';

const options: MongoClientOptions = {
  maxPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  retryWrites: true,
  retryReads: true,
  authSource: 'admin',
  directConnection: true,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
};

let client: MongoClient | null = null;
let isConnecting = false;
let retryCount = 0;
const MAX_RETRIES = 3;

export async function connectToDatabase(): Promise<MongoClient> {
  if (!client && !isConnecting) {
    isConnecting = true;
    try {
      console.log('Tentando conectar ao MongoDB (Railway Internal)...');
      client = new MongoClient(MONGODB_URL, options);
      
      while (retryCount < MAX_RETRIES) {
        try {
          await client.connect();
          console.log('Conectado ao MongoDB');
          
          const adminDb = client.db("admin");
          await adminDb.command({ ping: 1 });
          console.log("Ping ao banco de dados bem-sucedido");
          
          const mainDb = client.db("decore_db");
          await mainDb.command({ ping: 1 });
          console.log("Banco de dados principal acessível");
          
          retryCount = 0;
          break;
        } catch (error) {
          retryCount++;
          console.error(`Tentativa ${retryCount} falhou:`, error);
          
          if (retryCount >= MAX_RETRIES) {
            throw new Error(`Falha após ${MAX_RETRIES} tentativas de conexão`);
          }
          
          await client.close(true);
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          client = new MongoClient(MONGODB_URL, options);
        }
      }
    } catch (error) {
      console.error('Erro fatal de conexão com MongoDB:', error);
      if (client) {
        await client.close(true);
      }
      client = null;
      throw new Error('Falha ao conectar com o banco de dados');
    } finally {
      isConnecting = false;
    }
  }
  
  if (!client) {
    throw new Error('Cliente MongoDB não está inicializado');
  }
  
  return client;
}

// ... resto do código permanece igual ...
