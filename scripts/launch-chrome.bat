@echo off
taskkill /F /IM chrome.exe 2>nul
timeout /t 3 /nobreak >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Users\evanr\AppData\Local\Google\Chrome\User Data" --profile-directory="Profile 1"
