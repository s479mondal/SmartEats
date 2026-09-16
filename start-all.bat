@echo off
title SmartEats - Start All Services
cd /d "%~dp0"
set PYTHON_EXE=rdss-ai-service\.venv\Scripts\python.exe
if not exist "%PYTHON_EXE%" (
    set PYTHON_EXE=python
)
echo ===================================================
echo     Starting SmartEats Distributed System...
echo ===================================================
"%PYTHON_EXE%" start_all.py
pause
