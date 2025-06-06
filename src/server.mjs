import express from 'express';
import cors from 'cors';
import { connectToDatabase, getReportsCollection } from './mongodb.mjs';
import dotenv from 'dotenv';

// Configurar dotenv
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Configurar CORS para permitir apenas origens específicas em produção
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://decore-frontend.vercel.app', 'http://localhost:3000']
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Função para obter a coleção de estoque
async function getStockCollection() {
  const client = await connectToDatabase();
  const db = client.db("decore_db");
  return db.collection('stock');
}

// Rota de healthcheck
app.get('/', (req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV });
});

// Test connection endpoint
app.get('/api/test-connection', async (req, res) => {
  try {
    await connectToDatabase();
    res.json({ status: 'connected' });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: 'Failed to connect to database' });
  }
});

// Rotas de Estoque
app.get('/api/stock', async (req, res) => {
  try {
    const collection = await getStockCollection();
    const stock = await collection.findOne();
    if (!stock) {
      // Se não existir, criar estoque inicial
      const initialStock = {
        items: {
          v1: {
            model: 'ZTE 670 V1',
            quantity: 0,
            lastUpdate: new Date().toISOString(),
            status: 'DISPONÍVEL'
          },
          v9: {
            model: 'ZTE 670 V9',
            quantity: 0,
            lastUpdate: new Date().toISOString(),
            status: 'DISPONÍVEL'
          }
        },
        movements: []
      };
      await collection.insertOne(initialStock);
      res.json(initialStock);
    } else {
      res.json(stock);
    }
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

// ... rest of your routes ...

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Iniciar servidor com tratamento de erro
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode`);
  console.log(`Server URL: ${process.env.NODE_ENV === 'production' ? process.env.RAILWAY_STATIC_URL : `http://localhost:${port}`}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please try another port.`);
  } else {
    console.error('Server error:', error);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 