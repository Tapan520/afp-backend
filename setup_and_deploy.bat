@echo off
echo.
echo ================================================
echo   All For Pets - GitHub + Railway Setup Script
echo ================================================
echo.

:: Check git is installed
git --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git is not installed.
  echo Download from: https://git-scm.com/download/win
  pause
  exit /b
)

cd /d "%~dp0"

echo [1/5] Setting up Git repository...
git init
git add .
git commit -m "All For Pets backend - initial commit"

echo.
echo [2/5] Configuring GitHub account...
git config user.email "tapchauhan2001@gmail.com"
git config user.name "Tap Chauhan"

echo.
echo ================================================
echo  NEXT STEP - Do this NOW (takes 2 minutes):
echo ================================================
echo.
echo  1. Open this URL in your browser:
echo     https://github.com/new
echo.
echo  2. Repository name: afp-backend
echo  3. Keep it Public
echo  4. DO NOT tick "Add README" or any checkbox
echo  5. Click "Create repository"
echo.
echo  6. Come back here and press any key...
echo ================================================
pause

echo.
echo [3/5] Connecting to GitHub...
echo Enter your GitHub username (the part before @gmail.com or your GitHub handle):
set /p GH_USER=GitHub username: 

git remote add origin https://github.com/%GH_USER%/afp-backend.git
git branch -M main
git push -u origin main

if errorlevel 1 (
  echo.
  echo ERROR: Push failed. This usually means:
  echo  - Wrong username entered
  echo  - You need to authenticate with GitHub
  echo.
  echo Try this: Open GitHub Desktop app or run:
  echo   git config --global credential.helper manager
  echo Then run this script again.
  pause
  exit /b
)

echo.
echo [4/5] Code pushed to GitHub successfully!
echo.
echo ================================================
echo  FINAL STEP - Deploy on Railway (5 minutes):
echo ================================================
echo.
echo  1. Go to: https://railway.app
echo  2. Click "Login with GitHub" - use tapchauhan2001@gmail.com
echo  3. Click "New Project"
echo  4. Click "Deploy from GitHub repo"
echo  5. Select "afp-backend"
echo  6. Click "Deploy Now"
echo.
echo  7. Once deployed, click "+ New" then "Database" then "PostgreSQL"
echo.
echo  8. Click the PostgreSQL service, go to "Variables" tab
echo     Copy the DATABASE_URL value
echo.
echo  9. Click your backend service, go to "Variables" tab
echo     Add these variables:
echo     DATABASE_URL  = [paste what you copied]
echo     JWT_SECRET    = afp_railway_secret_2024
echo     NODE_ENV      = production
echo.
echo  10. Go to Settings tab, click "Generate Domain"
echo      You will get a URL like:
echo      https://afp-backend-xxxx.up.railway.app
echo.
echo  11. Test it - open this in browser:
echo      https://afp-backend-xxxx.up.railway.app/health
echo      Should show: {"status":"ok"}
echo.
echo  12. Open AllForPets_Connected_App.js in Notepad
echo      Change line 11 to your Railway URL:
echo      const API_BASE = 'https://afp-backend-xxxx.up.railway.app';
echo.
echo  13. Paste the updated file into https://snack.expo.dev
echo      Scan QR - DONE! Your app is fully live!
echo ================================================
echo.
echo [5/5] Setup complete. Follow the steps above.
pause
