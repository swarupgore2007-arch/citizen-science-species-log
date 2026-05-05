const express = require('express');
const Sighting = require('../models/Sighting');

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Get user's sightings
router.get('/my-sightings', authenticateToken, async (req, res) => {
  try {
    const sightings = await Sighting.find({ userId: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ sightings });
  } catch (error) {
    console.error('Get sightings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new sighting
router.post('/sightings', authenticateToken, async (req, res) => {
  try {
    const {
      species,
      category,
      location,
      lat,
      lon,
      date,
      time,
      notes,
      image,
      favorite,
      conservationStatus,
      rarityIndex,
      rarityLabel
    } = req.body;

    if (!species || !location || !lat || !lon || !date) {
      return res.status(400).json({ message: 'Required fields: species, location, lat, lon, date' });
    }

    const sighting = new Sighting({
      userId: req.user.id,
      username: req.user.username,
      species,
      category: category || 'Other',
      location,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      date,
      time: time || '',
      notes: notes || '',
      image: image || '',
      favorite: favorite || false,
      conservationStatus: conservationStatus || 'Unknown',
      rarityIndex: rarityIndex || 0,
      rarityLabel: rarityLabel || 'Insufficient Data',
      roleAtCreation: req.user.role
    });

    await sighting.save();
    res.status(201).json({
      message: 'Sighting added successfully',
      sighting
    });
  } catch (error) {
    console.error('Add sighting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update sighting
router.put('/sightings/:id', authenticateToken, async (req, res) => {
  try {
    const sighting = await Sighting.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!sighting) {
      return res.status(404).json({ message: 'Sighting not found' });
    }

    const updateFields = [
      'species', 'category', 'location', 'lat', 'lon', 'date', 'time',
      'notes', 'image', 'favorite', 'conservationStatus', 'rarityIndex', 'rarityLabel'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        sighting[field] = req.body[field];
      }
    });

    await sighting.save();
    res.json({
      message: 'Sighting updated successfully',
      sighting
    });
  } catch (error) {
    console.error('Update sighting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete sighting
router.delete('/sightings/:id', authenticateToken, async (req, res) => {
  try {
    const sighting = await Sighting.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!sighting) {
      return res.status(404).json({ message: 'Sighting not found' });
    }

    res.json({ message: 'Sighting deleted successfully' });
  } catch (error) {
    console.error('Delete sighting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all sightings (admin only)
router.get('/all-sightings', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const sightings = await Sighting.find({})
      .populate('userId', 'username role')
      .sort({ createdAt: -1 });
    res.json({ sightings });
  } catch (error) {
    console.error('Get all sightings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get species baseline data (public)
router.get('/species-baseline', async (req, res) => {
  try {
    // This would typically come from a separate collection or file
    // For now, return a message that frontend should load from local file
    res.json({
      message: 'Species baseline data should be loaded from species_baseline.json'
    });
  } catch (error) {
    console.error('Species baseline error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;