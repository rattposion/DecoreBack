import express from 'express';
import cors from 'cors';
import { connectToDatabase, getStockCollection, getReportsCollection, closeConnection } from './config/mongodb';
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
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  next();
});

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

// Rotas de Estoque
app.get('/api/stock', async (req: express.Request, res: express.Response) => {
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

// ... resto das rotas ...

// Iniciar servidor
const startServer = async () => {
  try {
    console.log('Iniciando servidor...');
    console.log('Ambiente:', process.env.NODE_ENV || 'development');
    
    await connectToDatabase();
    console.log('Conexão com MongoDB estabelecida');
    
    const server = app.listen(port, '0.0.0.0', () => {
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