@echo off
echo ========================================
echo   Démarrage du Backend Marketplace
echo ========================================
echo.
echo Connexion a la base de donnees: marketplacedb
echo.
cd /d "%~dp0"
npm run start:dev
pause
