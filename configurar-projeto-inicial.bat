@echo off
title Setup Inicial - Robo Alvara
color 0B
echo.
echo =======================================================
echo    SETUP INICIAL - ROBO ALVARA
echo =======================================================
echo.
echo Este script vai:
echo   1) Baixar e extrair o Node.js bundled (se ainda nao existir)
echo   2) Instalar as dependencias do projeto (npm install)
echo   3) Criar config\config.json a partir do sample
echo   4) Criar pastas necessarias (data\)
echo.

setlocal
set "PROJECT_ROOT=%~dp0"
set "NODE_VERSION=v25.9.0"
set "NODE_DIRNAME=node-%NODE_VERSION%-win-x64"
set "NODE_ZIP=%NODE_DIRNAME%.zip"
set "NODE_URL=https://nodejs.org/dist/%NODE_VERSION%/%NODE_ZIP%"
set "NODE_DIR=%PROJECT_ROOT%%NODE_DIRNAME%"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"

cd /d "%PROJECT_ROOT%"

REM --- 1) Node bundled ---
if exist "%NODE_EXE%" (
    echo [1/4] Node ja presente em %NODE_DIRNAME%\ — pulando download.
) else (
    echo [1/4] Baixando Node %NODE_VERSION% ...
    echo       %NODE_URL%
    where curl >nul 2>nul
    if %ERRORLEVEL%==0 (
        curl -L --fail -o "%NODE_ZIP%" "%NODE_URL%"
    ) else (
        echo       (curl nao encontrado, usando PowerShell)
        powershell -NoProfile -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%'"
    )
    if errorlevel 1 (
        echo [ERRO] Falha ao baixar Node.
        pause
        exit /b 1
    )

    echo [1/4] Extraindo %NODE_ZIP% ...
    powershell -NoProfile -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '.' -Force"
    if errorlevel 1 (
        echo [ERRO] Falha ao extrair Node.
        pause
        exit /b 1
    )

    del /Q "%NODE_ZIP%"

    if not exist "%NODE_EXE%" (
        echo [ERRO] node.exe nao foi encontrado em %NODE_DIR% apos extracao.
        pause
        exit /b 1
    )
    echo [1/4] Node instalado em %NODE_DIRNAME%\
)

REM --- 2) npm install ---
echo.
echo [2/4] Rodando npm install ...
call "%NPM_CMD%" install
if errorlevel 1 (
    echo [ERRO] npm install falhou.
    pause
    exit /b 1
)

REM --- 3) e 4) Setup do projeto via script Node ---
echo.
echo [3/4 + 4/4] Configurando projeto (data\, config\config.json) ...
"%NODE_EXE%" scripts\setup.js
if errorlevel 1 (
    echo [ERRO] Setup falhou.
    pause
    exit /b 1
)

echo.
echo =======================================================
echo    SETUP CONCLUIDO COM SUCESSO
echo =======================================================
echo.
echo PROXIMO PASSO:
echo   - Edite config\config.json com:
echo       CHAVE_GEMINI, URL_PLANILHA e PASTA_RAIZ
echo   - Depois execute: executar.bat
echo.
pause
endlocal
