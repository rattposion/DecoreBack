import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import { connectToDatabase, getStockCollection, getReportsCollection, closeConnection } from './config/mongodb.js';
import { UpdateFilter, Document, WithId, PushOperator, PullOperator } from 'mongodb';
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

// Interface para o movimento
interface Movement {
  date: string;
  type: string;
  source: string;
  destination: string;
  responsibleUser: string;
  observations: string;
  quantity: number;
}

// Interface para o documento de estoque
interface StockDocument extends WithId<Document> {
  items: {
    v1: { quantity: number; lastUpdate: string };
    v9: { quantity: number; lastUpdate: string };
  };
  movements: Movement[];
}

// Interface para o relatório
interface Report extends WithId<Document> {
  header: {
    date: string;
    supervisor: string;
    unit: string;
    shift: 'morning' | 'afternoon';
  };
  morning: Array<{
    name: string;
    tested: number;
    approved: number;
    rejected: number;
    cleaned: number;
    resetados: number;
    v9: number;
  }>;
  afternoon: Array<{
    name: string;
    v9: number;
    reset: number;
    cleaning: number;
    tested: number;
    cleaned: number;
    resetados: number;
  }>;
}

// Handler personalizado que permite retorno de Promise
type AsyncRequestHandler = (req: Request, res: Response) => Promise<any>;

// Tipos específicos para as operações de atualização
type StockUpdateOperation = {
  $set: {
    [key in 'items.v1.quantity' | 'items.v1.lastUpdate' | 'items.v9.quantity' | 'items.v9.lastUpdate']: string | number;
  };
};

type MovementPushOperation = {
  $push: {
    movements: {
      $each: Movement[];
    };
  };
};

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
    
    // Ordenar movimentos por data, do mais recente para o mais antigo
    const sortedMovements = movements.sort((a: Movement, b: Movement) => {
      const dateA = new Date(a.date || '');
      const dateB = new Date(b.date || '');
      return dateB.getTime() - dateA.getTime();
    });

    res.json(sortedMovements);
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
      date: new Date().toISOString() // Usar 'date' consistentemente
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

const deleteMovement: AsyncRequestHandler = async (req, res) => {
  try {
    const collection = await getStockCollection();
    const stock = await collection.findOne<StockDocument>();
    const movementDate = req.params.date;
    
    if (!stock) {
      res.status(404).json({ error: 'Estoque não encontrado' });
      return;
    }

    // Encontrar o movimento a ser excluído
    const movementToDelete = stock.movements.find(m => m.date === movementDate);
    if (!movementToDelete) {
      res.status(404).json({ error: 'Movimento não encontrado' });
      return;
    }

    // Calcular o ajuste no estoque
    const modelKey = movementToDelete.type === 'entry' ? 
      (movementToDelete.observations.includes('V1') ? 'v1' : 'v9') :
      (movementToDelete.observations.includes('V1') ? 'v1' : 'v9');

    const currentQuantity = stock.items[modelKey].quantity || 0;
    // Se era uma entrada, subtrair; se era uma saída, adicionar
    const quantityChange = movementToDelete.type === 'entry' ? 
      -movementToDelete.quantity : 
      movementToDelete.quantity;
    
    const newQuantity = currentQuantity + quantityChange;

    if (newQuantity < 0) {
      res.status(400).json({ error: 'Não é possível excluir este movimento pois resultaria em estoque negativo' });
      return;
    }

    // Atualizar o estoque e remover o movimento
    await collection.updateOne(
      {},
      {
        $pull: { movements: { date: movementDate } } as unknown as PullOperator<StockDocument>,
        $set: {
          [`items.${modelKey}.quantity`]: newQuantity,
          [`items.${modelKey}.lastUpdate`]: new Date().toISOString()
        }
      }
    );

    // Buscar o estoque atualizado
    const updatedStock = await collection.findOne<StockDocument>();
    res.json({
      message: 'Movimento excluído e estoque atualizado com sucesso',
      updatedStock
    });

  } catch (error) {
    console.error('Erro ao excluir movimento:', error);
    res.status(500).json({ error: 'Falha ao excluir movimento' });
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
    const report = await collection.findOne<Report>({ 'header.date': req.params.date });
    if (!report) {
      res.status(404).json({ error: 'Relatório não encontrado' });
      return;
    }

    // Calcular as quantidades totais do relatório
    const totalV1 = [...(report.morning || []), ...(report.afternoon || [])].reduce((sum, c) => 
      sum + (c.tested || 0), 0);
    const totalV9 = [...(report.morning || []), ...(report.afternoon || [])].reduce((sum, c) => 
      sum + (c.v9 || 0), 0);

    // Buscar o estoque atual
    const stock = await stockCollection.findOne<StockDocument>();
    if (!stock) {
      res.status(404).json({ error: 'Estoque não encontrado' });
      return;
    }

    // Remover as quantidades do estoque
    const newV1Quantity = Math.max(0, (stock.items.v1.quantity || 0) - totalV1);
    const newV9Quantity = Math.max(0, (stock.items.v9.quantity || 0) - totalV9);

    // Criar movimentos de ajuste separados para V1 e V9
    const movements: Movement[] = [];
    
    if (totalV1 > 0) {
      movements.push({
        date: new Date().toISOString(),
        type: 'exit',
        source: 'ESTOQUE',
        destination: 'AJUSTE',
        responsibleUser: 'Sistema',
        observations: `Saída por exclusão do relatório de ${req.params.date} - ZTE 670 V1`,
        quantity: totalV1
      });
    }

    if (totalV9 > 0) {
      movements.push({
        date: new Date().toISOString(),
        type: 'exit',
        source: 'ESTOQUE',
        destination: 'AJUSTE',
        responsibleUser: 'Sistema',
        observations: `Saída por exclusão do relatório de ${req.params.date} - ZTE 670 V9`,
        quantity: totalV9
      });
    }

    // Atualizar o estoque
    // Primeiro, atualizar as quantidades
    await stockCollection.updateOne({}, {
      $set: {
        'items.v1.quantity': newV1Quantity,
        'items.v1.lastUpdate': new Date().toISOString(),
        'items.v9.quantity': newV9Quantity,
        'items.v9.lastUpdate': new Date().toISOString()
      }
    });

    // Depois, adicionar os movimentos ao array
    if (movements.length > 0) {
      await stockCollection.updateOne({}, {
        $push: {
          movements: {
            $each: movements
          }
        }
      } as any);
    }

    // Finalmente, excluir o relatório
    const result = await collection.deleteOne({ 'header.date': req.params.date });
    
    // Buscar o estoque atualizado
    const updatedStock = await stockCollection.findOne<StockDocument>();

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

app.route('/api/stock/movement/:date')
  .delete(deleteMovement);

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