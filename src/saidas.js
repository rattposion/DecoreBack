import express from 'express';
import Saida from './models/Saida.js';

const router = express.Router();

// Get all exits
router.get('/', async (req, res) => {
  try {
    const saidas = await Saida.find().sort({ createdAt: -1 });
    res.status(200).json(saidas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new exit
router.post('/', async (req, res) => {
  try {
    const novaSaida = new Saida(req.body);
    const saidaSalva = await novaSaida.save();
    res.status(201).json(saidaSalva);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete an exit
router.delete('/:id', async (req, res) => {
  try {
    const saida = await Saida.findByIdAndDelete(req.params.id);
    if (!saida) {
      return res.status(404).json({ message: 'Saída não encontrada' });
    }
    res.status(200).json({ message: 'Saída deletada com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router; 