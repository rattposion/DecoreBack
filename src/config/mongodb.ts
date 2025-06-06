import { MongoClient, MongoClientOptions, ServerApiVersion } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

// Configurações do MongoDB do Railway
const MONGODB_URL = 'mongodb://mongo:GSxIXvNciEpMYKCHMrAQIzrcHIwnfGJC@turntable.proxy.rlwy.net:47692/decore_db';

const options: MongoClientOptions = {
  maxPoolSize: 1, // Reduzido para minimizar conexões
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  retryWrites: true,
  retryReads: true,
  authSource: 'admin',
  directConnection: true,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  // Configurações SSL/TLS
  ssl: true,
  tls: true,
  tlsAllowInvalidCertificates: true, // Apenas para desenvolvimento
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
      
      // Criar nova instância do cliente
      client = new MongoClient(MONGODB_URL, options);
      
      while (retryCount < MAX_RETRIES) {
        try {
          // Tentar estabelecer conexão
          await client.connect();
          console.log('Conectado ao MongoDB');
          
          // Verificar a conexão com ping
          const adminDb = client.db("admin");
          await adminDb.command({ ping: 1 });
          console.log("Ping ao banco de dados bem-sucedido");
          
          // Tentar acessar o banco de dados principal
          const mainDb = client.db("decore_db");
          await mainDb.command({ ping: 1 });
          console.log("Banco de dados principal acessível");
          
          // Log da URL (sem credenciais)
          const safeUrl = MONGODB_URL.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@');
          console.log("URL de conexão:", safeUrl);
          
          retryCount = 0;
          break;
        } catch (error) {
          retryCount++;
          console.error(`Tentativa ${retryCount} falhou:`, error);
          
          if (retryCount >= MAX_RETRIES) {
            throw new Error(`Falha após ${MAX_RETRIES} tentativas de conexão`);
          }
          
          // Fechar a conexão atual antes de tentar novamente
          try {
            await client.close(true);
          } catch (closeError) {
            console.error('Erro ao fechar conexão:', closeError);
          }
          
          // Esperar antes de tentar novamente (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Criar nova instância do cliente para a próxima tentativa
          client = new MongoClient(MONGODB_URL, options);
        }
      }
    } catch (error) {
      console.error('Erro fatal de conexão com MongoDB:', error);
      if (client) {
        try {
          await client.close(true);
        } catch (closeError) {
          console.error('Erro ao fechar conexão após falha:', closeError);
        }
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
