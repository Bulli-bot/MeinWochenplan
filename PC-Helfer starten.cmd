@echo off
title MeinWochenplan PC-Helfer
cd /d "%~dp0"
echo MeinWochenplan PC-Helfer (Bons auslesen, Rezepte per Link importieren)
echo Fenster offen lassen, solange du ihn brauchst. Ollama (Docker) muss laufen.
node pc-helfer.js
pause
