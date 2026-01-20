@echo off
echo Starting ZeroSec Backend Server...
echo.

REM Check if virtual environment exists
if exist venv (
    echo Activating virtual environment...
    call venv\Scripts\activate
) else (
    echo No virtual environment found. Installing dependencies globally...
)

echo.
echo Installing/updating dependencies...
pip install -q flask flask-cors ollama langchain langchain-community chromadb sentence-transformers

echo.
echo Starting Flask server on port 5200...
python app.py
