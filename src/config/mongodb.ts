import { MongoClient, MongoClientOptions } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

// Configurações do MongoDB do Railway
const MONGODB_URL = process.env.MONGO_URL || 'mongodb://mongo:GSxIXvNciEpMYKCHMrAQIzrcHIwnfGJC@turntable.proxy.rlwy.net:47692';

const options: MongoClientOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 60000, // Aumentado para 60 segundos
  socketTimeoutMS: 60000, // Aumentado para 60 segundos
  connectTimeoutMS: 60000, // Aumentado para 60 segundos
  retryWrites: true,
  retryReads: true,
  authSource: 'admin',
  directConnection: true // Força conexão direta
};

let client: MongoClient | null = null;
let isConnecting = false;
let retryCount = 0;
const MAX_RETRIES = 5;

export async function connectToDatabase(): Promise<MongoClient> {
  if (!client && !isConnecting) {
    isConnecting = true;
    try {
      console.log('Tentando conectar ao MongoDB...');
      client = new MongoClient(MONGODB_URL, options);
      
      // Tentar conectar com retry
      while (retryCount < MAX_RETRIES) {
        try {
          await client.connect();
          console.log('Conectado ao MongoDB');
          
          // Ping para verificar a conexão
          await client.db("admin").command({ ping: 1 });
          console.log("Ping ao banco de dados bem-sucedido");
          console.log("URL de conexão:", MONGODB_URL.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@'));
          
          // Resetar contadores após sucesso
          retryCount = 0;
          break;
        } catch (error) {
          retryCount++;
          console.error(`Tentativa ${retryCount} falhou:`, error);
          if (retryCount >= MAX_RETRIES) {
            throw new Error(`Falha após ${MAX_RETRIES} tentativas de conexão`);
          }
          // Esperar antes de tentar novamente (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, retryCount), 10000)));
        }
      }
    } catch (error) {
      console.error('Erro fatal de conexão com MongoDB:', error);
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

export async function getCollection(collectionName: string) {
  const dbClient = await connectToDatabase();
  return dbClient.db("decore_db").collection(collectionName);
}

export async function getReportsCollection() {
  return getCollection('relatorios');
}

export async function getStockCollection() {
  return getCollection('stock');
}

export async function closeConnection() {
  if (client) {
    try {
      await client.close();
      client = null;
      console.log('Conexão com MongoDB fechada');
    } catch (error) {
      console.error('Erro ao fechar conexão:', error);
      throw new Error('Falha ao fechar conexão com o banco de dados');
    }
  }
}

export async function testConnection() {
  try {
    const dbClient = await connectToDatabase();
    await dbClient.db("admin").command({ ping: 1 });
    return true;
  } catch (error) {
    console.error('Erro ao testar conexão com MongoDB:', error);
    return false;
  }
} 
