# Citizen Science Species Log - Full-Stack Application

A professional biodiversity intelligence platform for citizen science data collection, now with persistent storage and user authentication.

## Features

- **User Authentication**: Register/login with JWT-based sessions
- **Persistent Storage**: MongoDB database with user-specific data
- **Role-Based Access**: User, Admin, and Super Admin roles
- **Real-time Data**: Add, edit, delete sightings with location data
- **Data Visualization**: Charts, maps, and statistics
- **Admin Panel**: Manage users and view all data
- **Responsive Design**: Works on desktop and mobile

## Project Structure

```
citizen-science-species-log-main/
├── backend/                    # Node.js/Express server
│   ├── models/                # MongoDB schemas
│   │   ├── User.js           # User model
│   │   └── Sighting.js       # Sighting model
│   ├── routes/               # API routes
│   │   ├── auth.js          # Authentication routes
│   │   └── sightings.js     # Data routes
│   ├── server.js            # Main server file
│   ├── package.json         # Backend dependencies
│   └── .env                 # Environment variables
├── frontend/                 # Static frontend files
│   ├── index.html           # Main HTML
│   ├── script.js            # Main application logic
│   ├── authManager.js       # Authentication UI
│   ├── dataManager.js       # API data management
│   ├── style.css            # Styles
│   ├── species_baseline.json # Species data
│   └── user_data.json       # Legacy (can be removed)
└── README.md                # This file
```

### Quick Start

1. **Clone/Download** the project
2. **Install dependencies**: `npm install`
3. **Start MongoDB** service
4. **Run the application**: `npm start`

This will start both backend (port 3001) and frontend (port 8080).

### Manual Setup

- **Node.js** (v14 or higher) - Download from [nodejs.org](https://nodejs.org/)
- **MongoDB** (local installation or cloud instance like MongoDB Atlas)
- **npm** (comes with Node.js) or yarn

### Installing Prerequisites on Windows

1. **Install Node.js**:
   - Download the installer from [nodejs.org](https://nodejs.org/)
   - Run the installer and follow the setup wizard
   - Verify installation: Open Command Prompt and run `node --version` and `npm --version`

2. **Install MongoDB**:
   - Download from [mongodb.com](https://www.mongodb.com/try/download/community)
   - Run the installer
   - Start MongoDB service or use MongoDB Atlas (cloud)

### Backend Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment**
   Edit `backend/.env`:
   ```env
   PORT=3001
   MONGODB_URI=mongodb://localhost:27017/citizen-science
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ```

3. **Start MongoDB**
   Make sure MongoDB is running on your system.

4. **Start Backend Server**
   ```bash
   cd backend
   npm start
   # or for development:
   npm run dev
   ```

   The API will be available at `http://localhost:3001`

### Frontend Setup

1. **Serve Frontend Files**
   You can serve the frontend files using any static file server, or simply open `index.html` in a browser.

   For a simple server:
   ```bash
   # Using Python
   python -m http.server 8080

   # Using Node.js (install http-server globally)
   npx http-server -p 8080
   ```

2. **Access Application**
   Open `http://localhost:8080` in your browser.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `GET /api/auth/users` - Get all users (admin only)

### Sightings
- `GET /api/my-sightings` - Get user's sightings
- `POST /api/sightings` - Add new sighting
- `PUT /api/sightings/:id` - Update sighting
- `DELETE /api/sightings/:id` - Delete sighting
- `GET /api/all-sightings` - Get all sightings (admin only)

## Default Admin Account

- **Username**: `samadhan`
- **Password**: `samadhan`
- **Role**: Super Admin

## Development

### Adding New Features

1. **Backend**: Add new routes in `backend/routes/`
2. **Frontend**: Update `dataManager.js` for new API calls
3. **Models**: Add new fields to MongoDB schemas as needed

### Database Schema

#### User Model
```javascript
{
  username: String (unique),
  password: String (hashed),
  role: String (user|admin|super_admin),
  isActive: Boolean,
  createdAt: Date,
  lastLogin: Date
}
```

#### Sighting Model
```javascript
{
  userId: ObjectId (ref: User),
  username: String,
  species: String,
  category: String,
  location: String,
  lat: Number,
  lon: Number,
  date: String,
  time: String,
  notes: String,
  image: String,
  favorite: Boolean,
  conservationStatus: String,
  rarityIndex: Number,
  rarityLabel: String,
  roleAtCreation: String,
  createdAt: Date,
  updatedAt: Date
}
```

## Deployment

### Production Considerations

1. **Environment Variables**: Use strong JWT secrets
2. **Database**: Use MongoDB Atlas or secure MongoDB instance
3. **HTTPS**: Enable SSL/TLS
4. **Rate Limiting**: Add rate limiting to API endpoints
5. **Input Validation**: Enhance input validation
6. **Error Handling**: Improve error responses

### Docker Deployment

Create `Dockerfile` and `docker-compose.yml` for containerized deployment.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.