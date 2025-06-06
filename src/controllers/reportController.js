import Relatorio from '../models/Relatorio.js';

// Buscar todos os relatórios
export const getRelatorios = async (req, res) => {
  try {
    const relatorios = await Relatorio.find().sort({ 'header.date': -1 });
    res.status(200).json(relatorios);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Buscar relatório por data
export const getRelatorioPorData = async (req, res) => {
  try {
    const relatorio = await Relatorio.findOne({ 'header.date': req.params.date });
    if (!relatorio) {
      return res.status(404).json({ message: 'Relatório não encontrado' });
    }
    res.status(200).json(relatorio);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Criar ou atualizar relatório
export const salvarRelatorio = async (req, res) => {
  try {
    const { header: { date } } = req.body;
    
    // Procura por um relatório existente com a mesma data
    const relatorioExistente = await Relatorio.findOne({ 'header.date': date });
    
    if (relatorioExistente) {
      // Atualiza o relatório existente
      const relatorioAtualizado = await Relatorio.findByIdAndUpdate(
        relatorioExistente._id,
        req.body,
        { new: true }
      );
      return res.status(200).json(relatorioAtualizado);
    }

    // Cria um novo relatório
    const novoRelatorio = new Relatorio(req.body);
    const relatorioSalvo = await novoRelatorio.save();
    res.status(201).json(relatorioSalvo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Excluir relatório
export const excluirRelatorio = async (req, res) => {
  try {
    const relatorio = await Relatorio.findOneAndDelete({ 'header.date': req.params.date });
    if (!relatorio) {
      return res.status(404).json({ message: 'Relatório não encontrado' });
    }
    res.status(200).json({ message: 'Relatório excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 