import express from 'express';
import {
  getRelatorios,
  getRelatorioPorData,
  salvarRelatorio,
  excluirRelatorio
} from '../controllers/reportController.js';

const router = express.Router();

// Rotas para relatórios
router.get('/', getRelatorios);
router.get('/:date', getRelatorioPorData);
router.post('/', salvarRelatorio);
router.delete('/:date', excluirRelatorio);

export default router; 