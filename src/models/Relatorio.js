import mongoose from 'mongoose';

const collaboratorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  tested: {
    type: Number,
    default: 0
  },
  cleaned: {
    type: Number,
    default: 0
  },
  resetados: {
    type: Number,
    default: 0
  },
  v9: {
    type: Number,
    default: 0
  }
});

const relatorioSchema = new mongoose.Schema({
  header: {
    date: {
      type: String,
      required: true,
      unique: true
    },
    supervisor: String,
    unit: String
  },
  morning: [collaboratorSchema],
  afternoon: [collaboratorSchema],
  observations: {
    issues: String,
    highlights: String,
    attentionPoints: String
  },
  summary: {
    totalEquipment: {
      type: Number,
      default: 0
    },
    testedEquipment: {
      type: Number,
      default: 0
    },
    cleanedEquipment: {
      type: Number,
      default: 0
    },
    resetEquipment: {
      type: Number,
      default: 0
    },
    v9Equipment: {
      type: Number,
      default: 0
    },
    totalCollaborators: {
      type: Number,
      default: 0
    },
    morningCollaborators: {
      type: Number,
      default: 0
    },
    afternoonCollaborators: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

const Relatorio = mongoose.model('Relatorio', relatorioSchema);

export default Relatorio; 