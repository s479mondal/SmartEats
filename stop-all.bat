@echo off
title SmartEats - Stop All Services
cd /d "%~dp0"
set PYTHON_EXE=rdss-ai-service\.venv\Scripts\python.exe
if not exist "%PYTHON_EXE%" (
    set PYTHON_EXE=python
)
echo ===================================================
echo     Stopping All SmartEats Services...
echo ===================================================
"%PYTHON_EXE%" stop_all.py
pause
