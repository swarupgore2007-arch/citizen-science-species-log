const mongoose = require('mongoose');
require('dotenv').config();
const Sighting = require('./models/Sighting');

async function migrate() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in .env');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB. Starting historical data migration...');

    // We fetch all records. Mongoose might hide fields not in the schema, 
    // so we use .get() to access them if they exist in the raw document.
    const sightings = await Sighting.find({});
    let updatedCount = 0;

    for (const s of sightings) {
      let needsUpdate = false;

      // 1. Coordinates: Move lat/lon to the new coordinates object
      if (!s.coordinates || s.coordinates.lat === undefined) {
        const oldLat = s.get('lat');
        const oldLon = s.get('lon');
        if (oldLat !== undefined && oldLon !== undefined) {
          s.coordinates = { lat: oldLat, lng: oldLon };
          needsUpdate = true;
        }
      }

      // 2. Location: Map 'location' to 'locationName'
      if (!s.locationName && s.get('location')) {
        s.locationName = s.get('location');
        needsUpdate = true;
      }

      // 3. Verification: Default missing status to 'verified' for history
      if (!s.verificationStatus) {
        s.verificationStatus = 'verified';
        needsUpdate = true;
      }

      // 4. Defaults: Confidence and GPS
      if (!s.confidenceLevel) { s.confidenceLevel = 'medium'; needsUpdate = true; }
      if (s.isGPS === undefined) { s.isGPS = false; needsUpdate = true; }
      if (!s.evidenceImage && s.get('image')) { s.evidenceImage = s.get('image'); needsUpdate = true; }

      if (needsUpdate) {
        await s.save();
        updatedCount++;
      }
    }

    console.log(`Migration complete. Updated ${updatedCount} records to the new schema.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();