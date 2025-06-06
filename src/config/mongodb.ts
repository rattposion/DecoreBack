import { MongoClient, MongoClientOptions } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// Configurações do MongoDB do Railway
const MONGODB_URL = process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL || 'mongodb://localhost:27017/decore_db';

const options: MongoClientOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  retryReads: true,
  authSource: 'admin'
};

let client: MongoClient | null = null;

export async function connectToDatabase() {
  if (!client) {
    try {
      client = new MongoClient(MONGODB_URL, options);
      await client.connect();
      console.log('Conectado ao MongoDB');
      
      // Ping para verificar a conexão
      await client.db("admin").command({ ping: 1 });
      console.log("Ping ao banco de dados bem-sucedido");
      console.log("URL de conexão:", MONGODB_URL.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@'));
    } catch (error) {
      console.error('Erro de conexão com MongoDB:', error);
      throw new Error('Falha ao conectar com o banco de dados');
    }
  }
  return client;
}

export async function getCollection(collectionName: string) {
  const client = await connectToDatabase();
  return client.db("decore_db").collection(collectionName);
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
    const client = await connectToDatabase();
    await client.db("admin").command({ ping: 1 });
    return true;
  } catch (error) {
    console.error('Erro ao testar conexão com MongoDB:', error);
    return false;
  }
} 
