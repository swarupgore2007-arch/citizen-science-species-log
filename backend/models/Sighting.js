const mongoose = require('mongoose');

const sightingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  species: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Bird', 'Mammal', 'Reptile', 'Amphibian', 'Insect', 'Plant', 'Butterfly', 'Dragonfly', 'Other'],
    default: 'Other'
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  lat: {
    type: Number,
    required: true
  },
  lon: {
    type: Number,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: ''
  },
  favorite: {
    type: Boolean,
    default: false
  },
  conservationStatus: {
    type: String,
    default: 'Unknown'
  },
  rarityIndex: {
    type: Number,
    default: 0
  },
  rarityLabel: {
    type: String,
    default: 'Insufficient Data'
  },
  roleAtCreation: {
    type: String,
    enum: ['user', 'admin', 'super_admin'],
    default: 'user'
  }
}, {
  timestamps: true
});

// Index for efficient queries
sightingSchema.index({ userId: 1, createdAt: -1 });
sightingSchema.index({ species: 1 });
sightingSchema.index({ category: 1 });

module.exports = mongoose.model('Sighting', sightingSchema);