import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// Usando as variáveis do Railway
const MONGODB_HOST = process.env.MONGOHOST || 'mongodb.railway.internal';
const MONGODB_PORT = process.env.MONGOPORT || '27017';
const MONGODB_USER = process.env.MONGOUSER || 'mongo';
const MONGODB_PASSWORD = process.env.MONGOPASSWORD || 'GSxIXVMc1EpMYKCkMFXQIzrCHIwnfGJC';
const MONGODB_URL = process.env.MONGO_URL || 'mongodb://mongo:GSxIXVMc1EpMYKCkMFXQIzrCHIwnfGJC@mongodb.railway.internal:27017';

const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

let client;

export async function connectToDatabase() {
  if (!client) {
    try {
      client = await MongoClient.connect(MONGODB_URL, options);
      console.log('Conectado ao MongoDB');
      
      // Ping para verificar a conexão
      await client.db("admin").command({ ping: 1 });
      console.log("Ping ao banco de dados bem-sucedido");
    } catch (error) {
      console.error('Erro de conexão com MongoDB:', error);
      throw new Error('Falha ao conectar com o banco de dados');
    }
  }
  return client;
}

export async function getCollection(collectionName) {
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
