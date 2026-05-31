@echo off
echo ========================================================
echo   Constructor de Version Portable - Lottery Tracker Pro
echo ========================================================
echo.
echo Generando archivo lottery_portable.html...
echo.

python scripts\build_portable.py

echo.
echo ========================================================
echo   Proceso finalizado. 
echo   Puedes encontrar el archivo "lottery_portable.html"
echo   en esta misma carpeta.
echo ========================================================
pause
