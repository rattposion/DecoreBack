import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb+srv://decore:Wesley26.@decore.xvhk00w.mongodb.net/decore_db?retryWrites=true&w=majority';
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

let client;

export async function connectToDatabase() {
  if (!client) {
    try {
      client = await MongoClient.connect(uri, options);
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