@echo off
title Evidence Card System
python evidence-card.py
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to run the program
    echo Make sure you ran setup.bat first
    pause
)