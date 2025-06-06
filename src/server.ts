import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import { connectToDatabase, getStockCollection, getReportsCollection, closeConnection } from './config/mongodb.js';
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
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }
  next(err);
};

app.use(errorHandler);

// Rota de healthcheck
app.get('/', (req: express.Request, res: express.Response) => {
  res.json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test connection endpoint
app.get('/api/test-connection', async (req: express.Request, res: express.Response) => {
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

// Interface personalizada para os handlers
type AsyncRequestHandler = (req: Request, res: Response) => Promise<any>;

// Rotas de Estoque
const getStock: AsyncRequestHandler = async (req, res) => {
  try {
    const collection = await getStockCollection();
    const stock = await collection.findOne();
    res.json(stock);
  } catch (error) {
    console.error('Erro ao buscar estoque:', error);
    res.status(500).json({ error: 'Falha ao buscar estoque' });
  }
};

const updateStock: AsyncRequestHandler = async (req, res) => {
  try {
    const collection = await getStockCollection();
    const result = await collection.updateOne({}, { $set: req.body }, { upsert: true });
    res.json(result);
  } catch (error) {
    console.error('Erro ao atualizar estoque:', error);
    res.status(500).json({ error: 'Falha ao atualizar estoque' });
  }
};

const getMovements: AsyncRequestHandler = async (req, res) => {
  try {
    const collection = await getStockCollection();
    const stock = await collection.findOne();
    const movements = stock?.movements || [];
    res.json(movements);
  } catch (error) {
    console.error('Erro ao buscar movimentações:', error);
    res.status(500).json({ error: 'Falha ao buscar movimentações' });
  }
};

const addMovement: AsyncRequestHandler = async (req, res) => {
  try {
    const collection = await getStockCollection();
    const stock = await collection.findOne();
    
    if (!stock) {
      res.status(404).json({ error: 'Estoque não encontrado' });
      return;
    }

    const movement = {
      ...req.body,
      timestamp: new Date().toISOString()
    };

    const modelKey = req.body.model === 'ZTE 670 V1' ? 'v1' : 'v9';
    const currentQuantity = stock.items[modelKey].quantity || 0;
    const quantityChange = req.body.type === 'entry' ? req.body.quantity : -req.body.quantity;
    const newQuantity = currentQuantity + quantityChange;

    if (newQuantity < 0) {
      return res.status(400).json({ error: 'Quantidade insuficiente em estoque' });
    }

    const result = await collection.updateOne(
      {},
      { 
        $push: { movements: movement },
        $set: { 
          [`items.${modelKey}.quantity`]: newQuantity,
          [`items.${modelKey}.lastUpdate`]: new Date().toISOString()
        }
      }
    );

    // Buscar o estoque atualizado
    const updatedStock = await collection.findOne();
    res.status(201).json(updatedStock);
  } catch (error) {
    console.error('Erro ao adicionar movimento:', error);
    res.status(500).json({ error: 'Falha ao adicionar movimento' });
  }
};

// Rotas de Relatórios
const getReports: AsyncRequestHandler = async (req, res) => {
  try {
    const collection = await getReportsCollection();
    const reports = await collection.find({}).toArray();
    res.json(reports);
  } catch (error) {
    console.error('Erro ao buscar relatórios:', error);
    res.status(500).json({ error: 'Falha ao buscar relatórios' });
  }
};

const createReport: AsyncRequestHandler = async (req, res) => {
  try {
    const collection = await getReportsCollection();
    const result = await collection.insertOne(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('Erro ao criar relatório:', error);
    res.status(500).json({ error: 'Falha ao criar relatório' });
  }
};

const getReport: AsyncRequestHandler = async (req, res) => {
  try {
    const collection = await getReportsCollection();
    const report = await collection.findOne({ 'header.date': req.params.date });
    if (!report) {
      res.status(404).json({ error: 'Relatório não encontrado' });
      return;
    }
    res.json(report);
  } catch (error) {
    console.error('Erro ao buscar relatório:', error);
    res.status(500).json({ error: 'Falha ao buscar relatório' });
  }
};

const updateReport: AsyncRequestHandler = async (req, res) => {
  try {
    const collection = await getReportsCollection();
    const result = await collection.updateOne(
      { 'header.date': req.params.date },
      { $set: req.body },
      { upsert: true }
    );
 
    res.json(result);
  } catch (error) {
    console.error('Erro ao atualizar relatório:', error);
    res.status(500).json({ error: 'Falha ao atualizar relatório' });
  }
};

const deleteReport: AsyncRequestHandler = async (req, res) => {
  try {
    const collection = await getReportsCollection();
    const stockCollection = await getStockCollection();
    
    // Primeiro, buscar o relatório para saber as quantidades
    const report = await collection.findOne({ 'header.date': req.params.date });
    if (!report) {
      return res.status(404).json({ error: 'Relatório não encontrado' });
    }

    // Calcular as quantidades totais do relatório
    const totalV1 = [...(report.morning || []), ...(report.afternoon || [])].reduce((sum, c) => 
      sum + (c.tested || 0), 0);
    const totalV9 = [...(report.morning || []), ...(report.afternoon || [])].reduce((sum, c) => 
      sum + (c.v9 || 0), 0);

    // Buscar o estoque atual
    const stock = await stockCollection.findOne();
    if (!stock) {
      return res.status(404).json({ error: 'Estoque não encontrado' });
    }

    // Remover as quantidades do estoque
    const newV1Quantity = Math.max(0, (stock.items.v1.quantity || 0) - totalV1);
    const newV9Quantity = Math.max(0, (stock.items.v9.quantity || 0) - totalV9);

    // Atualizar o estoque
    const adjustmentMovement = {
      date: new Date().toISOString(),
      type: 'adjustment',
      source: 'SISTEMA',
      destination: 'AJUSTE',
      responsibleUser: 'Sistema',
      observations: `Ajuste automático por exclusão do relatório de ${req.params.date}`,
      quantity: totalV1 + totalV9
    };

    await stockCollection.updateOne(
      {},
      {
        $set: {
          'items.v1.quantity': newV1Quantity,
          'items.v1.lastUpdate': new Date().toISOString(),
          'items.v9.quantity': newV9Quantity,
          'items.v9.lastUpdate': new Date().toISOString()
        },
        $push: {
          movements: adjustmentMovement
        }
      }
    );

    // Finalmente, excluir o relatório
    const result = await collection.deleteOne({ 'header.date': req.params.date });
    
    // Buscar o estoque atualizado
    const updatedStock = await stockCollection.findOne();

    res.json({ 
      message: 'Relatório excluído e estoque ajustado com sucesso',
      deletedReport: report,
      updatedStock: updatedStock
    });
  } catch (error) {
    console.error('Erro ao excluir relatório:', error);
    res.status(500).json({ error: 'Falha ao excluir relatório' });
  }
};

// Configurar rotas
app.route('/api/stock')
  .get(getStock)
  .put(updateStock);

app.route('/api/stock/movements')
  .get(getMovements);

app.route('/api/stock/movement')
  .post(addMovement);

app.route('/api/reports')
  .get(getReports)
  .post(createReport);

app.route('/api/reports/:date')
  .get(getReport)
  .put(updateReport)
  .delete(deleteReport);

// Iniciar servidor
const startServer = async () => {
  try {
    console.log('Iniciando servidor...');
    console.log('Ambiente:', process.env.NODE_ENV || 'development');
    
    await connectToDatabase();
    console.log('Conexão com MongoDB estabelecida');
    
    const server = app.listen(Number(port), '0.0.0.0', () => {
      console.log(`Servidor rodando na porta ${port}`);
      console.log(`URL do servidor: ${process.env.RAILWAY_STATIC_URL || `http://localhost:${port}`}`);
    });

    // Tratamento de erros do servidor
    server.on('error', (error) => {
      console.error('Erro no servidor:', error);
      process.exit(1);
    });

    // Desligamento gracioso
    process.on('SIGINT', async () => {
      console.log('\nDesligando servidor graciosamente...');
      server.close(async () => {
        try {
          await closeConnection();
          console.log('Servidor fechado com sucesso');
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

// Iniciar o servidor
startServer().catch(error => {
  console.error('Erro ao iniciar aplicação:', error);
  process.exit(1);
}); 
