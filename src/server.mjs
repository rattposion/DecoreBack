import express from 'express';
import cors from 'cors';
import { connectToDatabase, getStockCollection, getReportsCollection } from './mongodb.mjs';
import dotenv from 'dotenv';

// Configurar dotenv
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Configurar CORS para permitir apenas origens específicas em produção
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://decore-s.vercel.app', 'http://localhost:3000']
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rota de healthcheck
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Test connection endpoint
app.get('/api/test-connection', async (req, res) => {
  try {
    await connectToDatabase();
    res.json({ 
      status: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro de conexão:', error);
    res.status(500).json({ 
      error: 'Falha na conexão com o banco de dados',
      timestamp: new Date().toISOString()
    });
  }
});

// Rotas de Estoque
app.get('/api/stock', async (req, res) => {
  try {
    const collection = await getStockCollection();
    const stock = await collection.findOne();
    
    if (!stock) {
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
    console.error('Erro ao buscar estoque:', error);
    res.status(500).json({ error: 'Falha ao buscar estoque' });
  }
});

app.put('/api/stock', async (req, res) => {
  try {
    const collection = await getStockCollection();
    const { items } = req.body;
    
    if (!items) {
      return res.status(400).json({ error: 'Dados do estoque inválidos' });
    }

    const result = await collection.updateOne(
      {},
      { $set: { items, lastUpdate: new Date().toISOString() } },
      { upsert: true }
    );

    res.json(result);
  } catch (error) {
    console.error('Erro ao atualizar estoque:', error);
    res.status(500).json({ error: 'Falha ao atualizar estoque' });
  }
});

app.post('/api/stock/movement', async (req, res) => {
  try {
    const collection = await getStockCollection();
    const movement = req.body;
    
    if (!movement || !movement.type || !movement.quantity) {
      return res.status(400).json({ error: 'Dados da movimentação inválidos' });
    }

    const stock = await collection.findOne();
    if (!stock) {
      return res.status(404).json({ error: 'Estoque não encontrado' });
    }

    const movements = stock.movements || [];
    movements.push({
      ...movement,
      timestamp: new Date().toISOString()
    });

    const result = await collection.updateOne(
      {},
      { $set: { movements } }
    );

    res.json(result);
  } catch (error) {
    console.error('Erro ao registrar movimentação:', error);
    res.status(500).json({ error: 'Falha ao registrar movimentação' });
  }
});

// Rotas de Relatórios
app.get('/api/reports', async (req, res) => {
  try {
    const collection = await getReportsCollection();
    const reports = await collection.find({}).toArray();
    res.json(reports);
  } catch (error) {
    console.error('Erro ao buscar relatórios:', error);
    res.status(500).json({ error: 'Falha ao buscar relatórios' });
  }
});

app.get('/api/reports/:date', async (req, res) => {
  try {
    const collection = await getReportsCollection();
    const report = await collection.findOne({ 'header.date': req.params.date });
    
    if (!report) {
      return res.status(404).json({ error: 'Relatório não encontrado' });
    }
    
    res.json(report);
  } catch (error) {
    console.error('Erro ao buscar relatório:', error);
    res.status(500).json({ error: 'Falha ao buscar relatório' });
  }
});

app.post('/api/reports', async (req, res) => {
  try {
    const collection = await getReportsCollection();
    const report = req.body;
    
    if (!report || !report.header || !report.header.date) {
      return res.status(400).json({ error: 'Dados do relatório inválidos' });
    }

    const result = await collection.insertOne(report);
    res.status(201).json(result);
  } catch (error) {
    console.error('Erro ao salvar relatório:', error);
    res.status(500).json({ error: 'Falha ao salvar relatório' });
  }
});

// Middleware de erro
app.use((err, req, res, next) => {
  console.error('Erro no servidor:', err);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando em modo ${process.env.NODE_ENV || 'development'}`);
  console.log(`URL do servidor: ${process.env.NODE_ENV === 'production' ? process.env.RAILWAY_STATIC_URL : `http://localhost:${port}`}`);
});

// Tratamento de erros do servidor
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Porta ${port} já está em uso. Tente outra porta.`);
  } else {
    console.error('Erro no servidor:', error);
  }
  process.exit(1);
});

// Desligamento gracioso
process.on('SIGINT', async () => {
  console.log('\nDesligando servidor graciosamente...');
  server.close(async () => {
    try {
      await closeConnection();
      console.log('Servidor fechado');
      process.exit(0);
    } catch (error) {
      console.error('Erro ao fechar servidor:', error);
      process.exit(1);
    }
  });
}); 
