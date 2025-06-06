import express from 'express';
import cors from 'cors';
import { connectToDatabase, getStockCollection, getReportsCollection, closeConnection } from './mongodb.mjs';
import dotenv from 'dotenv';

// Configurar dotenv
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Configurar CORS para permitir apenas origens específicas em produção
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://decore-s.vercel.app', 'http://localhost:3000', 'https://decore-frontend.vercel.app']
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('origin')}`);
  next();
});

// Middleware para tratar erros de JSON inválido
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  next();
});

// Rota de healthcheck
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test connection endpoint
app.get('/api/test-connection', async (req, res) => {
  try {
    await connectToDatabase();
    res.json({ 
      status: 'connected',
      timestamp: new Date().toISOString(),
      database: 'MongoDB Atlas'
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
      { 
        $set: { 
          items,
          lastUpdate: new Date().toISOString()
        }
      },
      { upsert: true }
    );

    const updatedStock = await collection.findOne();
    res.json(updatedStock);
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
    const newMovement = {
      ...movement,
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    };
    
    movements.push(newMovement);

    const result = await collection.updateOne(
      {},
      { 
        $set: { 
          movements,
          lastUpdate: new Date().toISOString()
        }
      }
    );

    const updatedStock = await collection.findOne();
    res.json(updatedStock);
  } catch (error) {
    console.error('Erro ao registrar movimentação:', error);
    res.status(500).json({ error: 'Falha ao registrar movimentação' });
  }
});

// Rotas de Relatórios
app.get('/api/reports', async (req, res) => {
  try {
    const collection = await getReportsCollection();
    const reports = await collection.find({}).sort({ 'header.date': -1 }).toArray();
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

    // Verificar se já existe um relatório para esta data
    const existingReport = await collection.findOne({ 'header.date': report.header.date });
    if (existingReport) {
      return res.status(409).json({ error: 'Já existe um relatório para esta data' });
    }

    const result = await collection.insertOne({
      ...report,
      createdAt: new Date().toISOString()
    });
    
    const savedReport = await collection.findOne({ _id: result.insertedId });
    res.status(201).json(savedReport);
  } catch (error) {
    console.error('Erro ao salvar relatório:', error);
    res.status(500).json({ error: 'Falha ao salvar relatório' });
  }
});

app.put('/api/reports/:date', async (req, res) => {
  try {
    const collection = await getReportsCollection();
    const report = req.body;
    const { date } = req.params;
    
    if (!report || !report.header || !report.header.date) {
      return res.status(400).json({ error: 'Dados do relatório inválidos' });
    }

    const result = await collection.updateOne(
      { 'header.date': date },
      { 
        $set: {
          ...report,
          updatedAt: new Date().toISOString()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Relatório não encontrado' });
    }

    const updatedReport = await collection.findOne({ 'header.date': date });
    res.json(updatedReport);
  } catch (error) {
    console.error('Erro ao atualizar relatório:', error);
    res.status(500).json({ error: 'Falha ao atualizar relatório' });
  }
});

app.delete('/reports/:date', async (req, res) => {
  try {
    const collection = await getReportsCollection();
    const { date } = req.params;

    const result = await collection.deleteOne({ 'header.date': date });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Relatório não encontrado' });
    }

    res.json({ message: 'Relatório excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir relatório:', error);
    res.status(500).json({ error: 'Falha ao excluir relatório' });
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
const startServer = async () => {
  try {
    // Tentar conectar ao MongoDB antes de iniciar o servidor
    await connectToDatabase();
    
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

  } catch (error) {
    console.error('Erro fatal ao iniciar servidor:', error);
    process.exit(1);
  }
};

// Iniciar o servidor com retry
let retryCount = 0;
const MAX_RETRIES = 5;

const startWithRetry = async () => {
  try {
    await startServer();
  } catch (error) {
    retryCount++;
    console.error(`Tentativa ${retryCount} de iniciar o servidor falhou:`, error);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`Tentando novamente em ${retryCount * 5} segundos...`);
      setTimeout(startWithRetry, retryCount * 5000);
    } else {
      console.error(`Falha após ${MAX_RETRIES} tentativas. Encerrando.`);
      process.exit(1);
    }
  }
};

startWithRetry(); 
