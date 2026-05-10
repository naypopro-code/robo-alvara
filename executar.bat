@echo off
title Triagem EAA-DVS
color 0B
echo.
echo =======================================================
echo           ROBO DE TRIAGEM EAA-DVS - main
echo =======================================================
echo.

setlocal
set "PROJECT_ROOT=%~dp0"
set "NODE_EXE=%PROJECT_ROOT%node-v25.9.0-win-x64\node.exe"

cd /d "%PROJECT_ROOT%"

if not exist "%NODE_EXE%" (
    echo [ERRO] Node nao encontrado em: %NODE_EXE%
    echo Verifique se a pasta node-v25.9.0-win-x64 existe na raiz do projeto.
    pause
    exit /b 1
)

echo [INFO] Executando src\main.js ...
echo.
"%NODE_EXE%" src\main.js
set "EXITCODE=%ERRORLEVEL%"

echo.
echo =======================================================
echo              PROCESSAMENTO CONCLUIDO (codigo %EXITCODE%)
echo =======================================================
echo.
echo Pressione qualquer tecla para fechar.
pause > nul
endlocal
exit /b %EXITCODE%
