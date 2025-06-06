import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import reportRoutes from './routes/reportRoutes.js';
import relatoriosRouter from './relatorios.js';
import saidasRouter from './saidas.js';

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/relatorios', reportRoutes);
app.use('/api/relatorios-old', relatoriosRouter);
app.use('/api/saidas', saidasRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 