# Frontend Integration Guide - API-Based Backend

## Overview

Your Citizen Science Species Log frontend has been fully integrated with the REST API backend. All data operations now use the API instead of local JSON files or localStorage.

## File Changes Summary

### 1. **dataManager.js** - Complete API Rewrite
- **Old**: Used localStorage for data persistence
- **New**: All operations use REST API endpoints
- **Methods**:
  - `DM.load()` - Fetch user's sightings from database
  - `DM.addSighting(data)` - Create new sighting
  - `DM.updateSighting(id, data)` - Update existing sighting
  - `DM.deleteSighting(id)` - Delete a sighting
  - `DM.getAllSightings()` - Get all sightings (admin only)
  - `DM.exportJSON(sightings)` - Export as JSON file
  - `DM.exportCSV(sightings)` - Export as CSV file

### 2. **authManager.js** - API Authentication
- **Authentication**: REST API-based instead of localStorage-only
- **Token Storage**: JWT stored in `localStorage.authToken`
- **User Storage**: User info stored in `localStorage.currentUser`
- **Features**:
  - Register new user
  - Login with credentials
  - Logout and clear session
  - Role-based UI (admin panel button for admins)

### 3. **script.js** - Updated for API Operations
- **Removed**: Fallbacks to localStorage for sightings
- **Updated Functions**:
  - `loadStoredSightings()` - Now only uses API via `DM.load()`
  - `addSighting()` - Creates sighting via `DM.addSighting()`
  - `saveEdit()` - Updates sighting via `DM.updateSighting()`
  - `confirmDelete()` - Deletes via `DM.deleteSighting()`
  - `getAuthUserRole()` - Uses Auth session instead of localStorage lookup

## API Endpoints Used

```
POST   /api/auth/register        - Register new user
POST   /api/auth/login           - Login user
GET    /api/my-sightings         - Fetch user's sightings
POST   /api/sightings            - Create new sighting
PUT    /api/sightings/:id        - Update sighting
DELETE /api/sightings/:id        - Delete sighting
GET    /api/all-sightings        - Get all sightings (admin)
```

## Authentication Flow

1. **User Opens App**
   - authManager.js checks for token in localStorage
   - If token exists, shows user UI and loads their sightings
   - If no token, shows login/register forms

2. **User Registers/Logs In**
   - authManager sends credentials to `/api/auth/register` or `/api/auth/login`
   - Backend returns JWT token and user object
   - authManager stores token and user in localStorage
   - Page reloads to show app

3. **All API Requests**
   - Token is read from localStorage
   - Sent in Authorization header: `Bearer {token}`
   - Backend validates token and verifies user identity
   - Operations are restricted to user's own data

## Data Flow

### Adding a Sighting

```
User fills form and clicks "Submit"
↓
script.js - addSighting() called
↓
Validates form data
↓
Calls DM.addSighting(sightingData)
↓
dataManager.js - Makes POST request to /api/sightings
↓
Backend creates sighting record in MongoDB
↓
Returns saved sighting (with _id from MongoDB)
↓
sightings array updated
↓
UI refreshed with new sighting
```

### Viewing Sightings

```
Page loads
↓
script.js - loadStoredSightings() called
↓
Calls DM.load()
↓
dataManager.js - Makes GET request to /api/my-sightings
↓
Backend queries MongoDB for user's sightings
↓
Returns array of sightings
↓
script.js updates sightings array
↓
UI renders all sightings
```

## Removed Features

The following features that relied on local files are no longer available:

- ❌ Local JSON file uploads (sightings_data.json, user_data.json)
- ❌ Offline mode (requires network connection to backend)
- ❌ localStorage-only persistence

## New Requirements

### Environment Setup

1. **Backend Running**
   ```bash
   cd backend
   npm install
   npm start
   ```
   - Backend must be running on `http://localhost:3001`
   - MongoDB connection required

2. **Frontend URL**
   ```bash
   cd frontend
   npx http-server -p 8080
   ```
   - Open `http://localhost:8080`

### Dependencies

Frontend still uses the local species_baseline.json:
- `frontend/species_baseline.json` - Species reference data (loaded locally)

### Network Connection

- **Required**: Connection to backend API at `http://localhost:3001`
- **If backend is down**: App will not function
- **Error Messages**: Users will see clear error messages if API calls fail

## Error Handling

All API calls include error handling:

```javascript
try {
  const data = await DM.addSighting(sightingData);
  // Success - update UI
} catch (error) {
  showToast('Failed to add sighting: ' + error.message, 'error');
  // Error shown to user
}
```

Common errors:

- **"No authentication token"** - User is not logged in
- **"Invalid or expired token"** - Token needs to be refreshed (login again)
- **"HTTP 401"** - Unauthorized - wrong credentials
- **"Connection refused"** - Backend is not running
- **"HTTP 500"** - Server error - check backend logs

## Development Tips

### Testing the API

Use the browser console to test manually:

```javascript
// Check if logged in
window.Auth.isLoggedIn()

// Get current user
window.Auth.getCurrentUser()

// Get JWT token
localStorage.getItem('authToken')

// Manually load sightings
DM.load().then(data => console.log(data))

// Add a test sighting
DM.addSighting({
  species: 'Test Bird',
  category: 'Bird',
  location: 'Test Location',
  lat: 0,
  lon: 0,
  date: '2026-05-05'
})
```

### Debugging API Calls

Check browser Network tab:
1. Open DevTools (F12)
2. Go to Network tab
3. Perform an action (login, add sighting, etc.)
4. Look for API requests to `localhost:3001/api/...`
5. Click request to see details
6. Response tab shows server's reply

### Backend Logs

Check backend terminal for detailed logs:
```
[server output shows all API requests]
```

## Migration from Local Files

If you had data in local JSON files:

1. **Export from old system**: Open the app with old files, export sightings as JSON
2. **Add data via new API**: Manually add sightings through the UI
   - Or implement an import endpoint in the backend
   - Then use that to bulk import from JSON

## Security Notes

- ✅ Passwords are hashed on backend with bcrypt
- ✅ JWT tokens have 7-day expiration
- ✅ Tokens stored in localStorage (consider httpOnly cookie for production)
- ✅ User data is isolated by userId in database
- ⚠️ Do NOT share JWT tokens
- ⚠️ Change JWT_SECRET in production

## Next Steps

1. **Start Backend**: `npm start` in backend folder
2. **Start Frontend**: `npx http-server -p 8080` in frontend folder
3. **Register Account**: Open app and create new account
4. **Add Sightings**: All data now persists in MongoDB
5. **Share Data**: Multiple devices with same login see same data

## Support

### Common Issues

**Q: "Data manager not available"**
- A: Make sure dataManager.js is loaded before script.js in index.html

**Q: "Connection refused"**
- A: Backend is not running. Start it with `npm start`

**Q: "Invalid token"**
- A: JWT expired. Clear localStorage and login again
  - `localStorage.clear()` then refresh page

**Q: "Cannot read property of undefined"**
- A: Check browser console for full error. Might need to refresh page.

---

Your application is now fully integrated with the backend API and ready for production!