@echo off
echo Starting PMO Portfolio Backend Server
echo =====================================
cd /d "%~dp0backend"
echo.
echo Activating Python environment and starting Flask server...
echo Server will be available at: http://localhost:5000
echo.
python app.py
pause
