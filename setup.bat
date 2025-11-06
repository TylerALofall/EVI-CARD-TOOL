@echo off
echo ================================
echo Setting up Evidence Card System
echo ================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from https://python.org
    pause
    exit /b 1
)

echo Installing required packages...
echo.

REM Upgrade pip first
python -m pip install --upgrade pip

REM Install packages
pip install google-generativeai
pip install SpeechRecognition
pip install pyaudio
pip install requests

echo.
echo Creating folder structure...
python -c "from pathlib import Path; p=Path.home()/'EvidenceCards'; p.mkdir(exist_ok=True); (p/'templates').mkdir(exist_ok=True); (p/'files').mkdir(exist_ok=True); (p/'exports').mkdir(exist_ok=True); print(f'Created folders at: {p}')"

echo.
echo ================================
echo Installation Complete!
echo ================================
echo.
echo Your files will be stored in: %USERPROFILE%\EvidenceCards\
echo.
echo To run the program: double-click run.bat
echo To edit template: Edit prompt_revised.txt in templates folder
echo.
pause