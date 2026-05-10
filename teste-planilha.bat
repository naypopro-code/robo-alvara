@echo off
title Teste Conexao Planilha
setlocal
set "PROJECT_ROOT=%~dp0"
set "NODE_EXE=%PROJECT_ROOT%node-v25.9.0-win-x64\node.exe"

cd /d "%PROJECT_ROOT%"

if not exist "%NODE_EXE%" (
    echo [ERRO] Node nao encontrado em: %NODE_EXE%
    pause
    exit /b 1
)

"%NODE_EXE%" src\testePlanilha.js
set "EXITCODE=%ERRORLEVEL%"
echo.
pause > nul
endlocal
exit /b %EXITCODE%
