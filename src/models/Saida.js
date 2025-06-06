import mongoose from 'mongoose';

const saidaSchema = new mongoose.Schema({
  motivo: {
    type: String,
    required: true
  },
  data: {
    type: Date,
    required: true,
    default: Date.now
  },
  responsavel: {
    type: String,
    required: true
  },
  observacoes: {
    type: String
  }
}, {
  timestamps: true
});

const Saida = mongoose.model('Saida', saidaSchema);

export default Saida; 