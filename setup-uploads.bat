@echo off
echo ================================================
echo    All For Pets - File Upload Feature Setup
echo ================================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
  echo ?? Installing dependencies...
  call npm install
) else (
  echo ? Dependencies already installed
)

REM Check if uploads directory exists
if not exist "uploads" (
  echo ?? Creating uploads directory...
  mkdir uploads\pets uploads\certificates uploads\doctors uploads\shops
  echo ? Upload directories created
) else (
  echo ? Upload directories already exist
)

REM Check if .env exists
if not exist ".env" (
  echo ??  Creating .env file from .env.example...
  copy .env.example .env
  echo ? .env file created - Please update with your credentials
) else (
  echo ? .env file already exists
)

echo.
echo ================================================
echo    Setup Complete! ??
echo ================================================
echo.
echo Next steps:
echo 1. Update .env with your database credentials
echo 2. Run: npm start
echo 3. Test file upload endpoints
echo.
echo Endpoints available:
echo   POST /api/pets/:id/upload-photo
echo   POST /api/pets/:id/upload-certificate
echo.
echo See FILE_UPLOAD_GUIDE.md for detailed documentation
echo See TESTING_GUIDE.md for testing instructions
echo.
pause
