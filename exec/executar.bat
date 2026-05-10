@echo off
title Triagem EAA-DVS
color 0B
echo.
echo =======================================================
echo           ROBO DE TRIAGEM EAA-DVS - main
echo =======================================================
echo.

setlocal
pushd "%~dp0.."
set "PROJECT_ROOT=%CD%"
set "NODE_EXE=%PROJECT_ROOT%\node-v25.9.0-win-x64\node.exe"

if not exist "%NODE_EXE%" (
    echo [ERRO] Node nao encontrado em: %NODE_EXE%
    echo Rode exec\configurar-projeto-inicial.bat primeiro.
    popd
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
popd
endlocal
exit /b %EXITCODE%
