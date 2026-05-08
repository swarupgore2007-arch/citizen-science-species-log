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

async function getSightingsForUser(user) {
  // Requirement 7: Admin visibility depends ONLY on super_admin role
  // Requirement 3 & 5: Return ALL sightings for admin (handles missing userId/old schema)
  if (user.role === 'super_admin') {
    return Sighting.find({})
      .sort({ createdAt: -1 });
  }

  // For normal users, filter the results to only include sightings they created.
  return Sighting.find({ userId: user.id }).sort({ createdAt: -1 });
}

// Get sightings for the logged-in user, or all sightings for super admin
router.get('/sightings', authenticateToken, async (req, res) => {
  try {
    console.log("REQ USER:", req.user);
    console.log("ROLE:", req.user.role);
    const sightings = await getSightingsForUser(req.user);
    res.json({ sightings });
  } catch (error) {
    console.error('Get sightings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Backward-compatible endpoint used by the current frontend
router.get('/my-sightings', authenticateToken, async (req, res) => {
  try {
    const sightings = await getSightingsForUser(req.user);
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
      roleAtCreation: req.user.role,
      // Requirement: Default status is 'pending'
      verificationStatus: 'pending',
      imageProof: image || '',
      verifiedBy: null,
      verifiedAt: null
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
    // Find sighting: admins can find any, users only their own
    const query = (req.user.role === 'super_admin') 
      ? { _id: req.params.id } 
      : { _id: req.params.id, userId: req.user.id };

    const sighting = await Sighting.findOne(query);

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
    // Admin visibility logic for deletion
    const query = (req.user.role === 'super_admin') 
      ? { _id: req.params.id } 
      : { _id: req.params.id, userId: req.user.id };

    const sighting = await Sighting.findOneAndDelete(query);

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
    // Requirement 7: Depend ONLY on super_admin
    if (req.user.role !== 'super_admin') {
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

// GET: /api/admin/pending-sightings (super_admin only)
router.get('/admin/pending-sightings', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Super Admin access required' });
    }
    const sightings = await Sighting.find({ verificationStatus: 'pending' })
      .sort({ createdAt: -1 });
    res.json({ sightings });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH: /api/admin/verify/:id (super_admin only)
router.patch('/admin/verify/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Super Admin access required' });
    }
    const sighting = await Sighting.findByIdAndUpdate(
      req.params.id,
      { 
        verificationStatus: 'verified', 
        verifiedBy: req.user.id, 
        verifiedAt: new Date() 
      },
      { new: true }
    );
    res.json({ message: 'Sighting verified', sighting });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH: /api/admin/reject/:id (super_admin only)
router.patch('/admin/reject/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Super Admin access required' });
    }
    const sighting = await Sighting.findByIdAndUpdate(
      req.params.id,
      { verificationStatus: 'rejected' },
      { new: true }
    );
    res.json({ message: 'Sighting rejected', sighting });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get endangered species alerts (super_admin only)
router.get('/admin/endangered-alerts', authenticateToken, async (req, res) => {
  try {
    // Requirement: Accessible ONLY to super_admin
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Super Admin access required' });
    }

    const alerts = await Sighting.aggregate([
      {
        // Requirement 6: Only verified sightings affect analysis
        $match: { verificationStatus: "verified" }
      },
      {
        // Group by species and find the latest sighting date
        $group: {
          _id: "$species",
          lastSeenAt: { $max: "$createdAt" }
        }
      },
      {
        // Calculate days since last sighting
        $addFields: {
          daysSinceLastSighting: {
            $floor: {
              $divide: [
                { $subtract: [new Date(), "$lastSeenAt"] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        }
      },
      {
        // Filter for species not seen in at least 30 days
        $match: {
          daysSinceLastSighting: { $gte: 30 }
        }
      },
      {
        $project: {
          _id: 0,
          species: "$_id",
          lastSeen: { $dateToString: { format: "%Y-%m-%d", date: "$lastSeenAt" } },
          daysSinceLastSighting: 1,
          alertLevel: {
            $cond: {
              if: { $gte: ["$daysSinceLastSighting", 90] },
              then: "Possible endangered species",
              else: "Low activity"
            }
          }
        }
      },
      { $sort: { daysSinceLastSighting: -1 } }
    ]);

    res.json(alerts);
  } catch (error) {
    console.error('Endangered alerts error:', error);
    res.status(500).json({ message: 'Server error fetching alerts' });
  }
});

module.exports = router;
