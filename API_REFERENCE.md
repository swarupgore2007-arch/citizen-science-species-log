# API Quick Reference

## Base URL
```
http://localhost:3001/api
```

## Authentication Endpoints

### Register User
```
POST /auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "password": "securePassword123"
}

Response (201):
{
  "message": "User registered successfully",
  "token": "eyJhbGc...",
  "user": {
    "id": "60d5ec49c1234567890abcd1",
    "username": "john_doe",
    "role": "user"
  }
}
```

### Login User
```
POST /auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "securePassword123"
}

Response (200):
{
  "message": "Login successful",
  "token": "eyJhbGc...",
  "user": {
    "id": "60d5ec49c1234567890abcd1",
    "username": "john_doe",
    "role": "user"
  }
}
```

### Get User Profile
```
GET /auth/profile
Authorization: Bearer eyJhbGc...

Response (200):
{
  "user": {
    "id": "60d5ec49c1234567890abcd1",
    "username": "john_doe",
    "role": "user",
    "isActive": true,
    "createdAt": "2026-05-05T10:00:00.000Z",
    "lastLogin": "2026-05-05T15:30:00.000Z"
  }
}
```

### Get All Users (Admin Only)
```
GET /auth/users
Authorization: Bearer eyJhbGc...

Response (200):
{
  "users": [
    {
      "id": "60d5ec49c1234567890abcd1",
      "username": "john_doe",
      "role": "user",
      "isActive": true,
      "createdAt": "2026-05-05T10:00:00.000Z"
    },
    ...
  ]
}
```

## Sighting Endpoints

### Get User's Sightings
```
GET /my-sightings
Authorization: Bearer eyJhbGc...

Response (200):
{
  "sightings": [
    {
      "_id": "60d5ec49c1234567890abcd2",
      "userId": "60d5ec49c1234567890abcd1",
      "username": "john_doe",
      "species": "Peacock",
      "category": "Bird",
      "location": "Lake Shore",
      "lat": 28.5355,
      "lon": 77.3910,
      "date": "2026-05-05",
      "time": "14:30",
      "notes": "Saw a beautiful peacock near the lake",
      "image": "",
      "favorite": true,
      "conservationStatus": "Common",
      "rarityIndex": 0.5,
      "rarityLabel": "Common",
      "roleAtCreation": "user",
      "createdAt": "2026-05-05T15:30:00.000Z",
      "updatedAt": "2026-05-05T15:30:00.000Z"
    },
    ...
  ]
}
```

### Add New Sighting
```
POST /sightings
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "species": "Spotted Deer",
  "category": "Mammal",
  "location": "Forest Trail North",
  "lat": 28.5235,
  "lon": 77.3945,
  "date": "2026-05-05",
  "time": "09:15",
  "notes": "Spotted near the forest edge",
  "image": "data:image/jpeg;base64,...",
  "favorite": false,
  "conservationStatus": "Near Threatened",
  "rarityIndex": 0.8,
  "rarityLabel": "Rare"
}

Response (201):
{
  "message": "Sighting added successfully",
  "sighting": {
    "_id": "60d5ec49c1234567890abcd3",
    "userId": "60d5ec49c1234567890abcd1",
    "username": "john_doe",
    "species": "Spotted Deer",
    ...
  }
}
```

### Update Sighting
```
PUT /sightings/60d5ec49c1234567890abcd3
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "species": "Spotted Deer",
  "notes": "Updated observation details",
  "favorite": true
}

Response (200):
{
  "message": "Sighting updated successfully",
  "sighting": {
    "_id": "60d5ec49c1234567890abcd3",
    "userId": "60d5ec49c1234567890abcd1",
    ...
    "notes": "Updated observation details",
    "favorite": true
  }
}
```

### Delete Sighting
```
DELETE /sightings/60d5ec49c1234567890abcd3
Authorization: Bearer eyJhbGc...

Response (200):
{
  "message": "Sighting deleted successfully"
}
```

### Get All Sightings (Admin Only)
```
GET /all-sightings
Authorization: Bearer eyJhbGc...

Response (200):
{
  "sightings": [
    {
      "_id": "60d5ec49c1234567890abcd2",
      "userId": "60d5ec49c1234567890abcd1",
      "username": "john_doe",
      "species": "Peacock",
      ...
    },
    ...
  ]
}
```

## Error Responses

### 400 Bad Request
```
{
  "message": "Required fields: species, location, lat, lon, date"
}
```

### 401 Unauthorized
```
{
  "message": "Access token required"
}
```

### 403 Forbidden
```
{
  "message": "Invalid or expired token"
}
```

### 404 Not Found
```
{
  "message": "Sighting not found"
}
```

### 500 Server Error
```
{
  "message": "Server error"
}
```

## Header Examples

### Authentication Header
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwZDVlYzQ5YzEyMzQ1Njc4OTBhYmNkMSIsInVzZXJuYW1lIjoiam9obiIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzE0OTUyNDAwLCJleHAiOjE3MTU1NTc0MDB9.abcdef...
```

### Content Type
```
Content-Type: application/json
```

## Sample cURL Commands

### Register
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john_doe","password":"pass123"}'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john_doe","password":"pass123"}'
```

### Get Sightings
```bash
curl -X GET http://localhost:3001/api/my-sightings \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Add Sighting
```bash
curl -X POST http://localhost:3001/api/sightings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "species":"Peacock",
    "category":"Bird",
    "location":"Lake Shore",
    "lat":28.5355,
    "lon":77.3910,
    "date":"2026-05-05"
  }'
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - No/invalid token |
| 403 | Forbidden - Token invalid/expired |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error - Backend error |

## Notes

- All responses are JSON
- Timestamps are ISO 8601 format
- Image data should be base64 encoded
- JWT tokens expire after 7 days
- User can only see their own sightings (except admins)
- Admin can see all sightings from all users