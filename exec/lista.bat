@echo off
title Listar Modelos Gemini
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

"%NODE_EXE%" src\lista.js
set "EXITCODE=%ERRORLEVEL%"
echo.
pause > nul
popd
endlocal
exit /b %EXITCODE%
