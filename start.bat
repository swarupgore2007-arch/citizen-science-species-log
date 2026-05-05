@echo off
echo Starting Citizen Science Species Log...
echo.

echo Checking if MongoDB is running...
echo Please make sure MongoDB is started before running the backend.
echo.

echo Starting backend server...
cd backend
start cmd /k "npm start"

timeout /t 3 /nobreak > nul

echo Starting frontend server...
cd ../frontend
start cmd /k "npx http-server -p 8080 -c-1"

echo.
echo Backend API: http://localhost:3001
echo Frontend: http://localhost:8080
echo.
echo Press any key to exit...
pause > nul