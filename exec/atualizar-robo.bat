@echo off
setlocal enabledelayedexpansion
title Atualizar Robo Alvara (GitHub ZIP)
color 0B

echo.
echo =======================================================
echo    ATUALIZAR ROBO ALVARA - DOWNLOAD GITHUB
echo =======================================================
echo.
echo Este script baixa a versao mais recente do GitHub
echo e atualiza os arquivos do projeto na pasta escolhida.
echo.
echo Itens preservados na atualizacao:
echo   - config\config.json
echo   - data\documentos\  (PDFs das pastas)
echo   - node-v*-win-x64\   (Node bundled, se ja existir)
echo.

set "ZIP_URL=https://github.com/naypopro-code/robo-alvara/archive/refs/heads/main.zip"
set "DEFAULT_DEST=C:\Users\nayarapb\Documents\Teste_Robo_EAA_DVS"
set "ZIP_NAME=robo-alvara-main.zip"
set "WORK_DIR=%TEMP%\robo-alvara-update"
set "EXTRACT_DIR=%WORK_DIR%\extract"

echo Pasta padrao de destino:
echo   %DEFAULT_DEST%
echo.
set /p "DEST=Pasta de destino (Enter = padrao): "
if "%DEST%"=="" set "DEST=%DEFAULT_DEST%"

echo.
echo Destino confirmado: %DEST%
set /p "CONFIRM=Continuar? (S/N) [S]: "
if /I "%CONFIRM%"=="N" (
    echo [INFO] Operacao cancelada.
    exit /b 0
)

if not exist "%DEST%" (
    echo.
    echo [INFO] Pasta nao existe. Criando: %DEST%
    mkdir "%DEST%" 2>nul
    if errorlevel 1 (
        echo [ERRO] Nao foi possivel criar a pasta de destino.
        pause
        exit /b 1
    )
)

echo.
echo [1/5] Preparando area temporaria...
if exist "%WORK_DIR%" rmdir /S /Q "%WORK_DIR%" 2>nul
mkdir "%WORK_DIR%" 2>nul
mkdir "%EXTRACT_DIR%" 2>nul

set "ZIP_PATH=%WORK_DIR%\%ZIP_NAME%"

echo [2/5] Baixando codigo do GitHub...
echo       %ZIP_URL%
where curl >nul 2>nul
if %ERRORLEVEL%==0 (
    curl -L --fail -o "%ZIP_PATH%" "%ZIP_URL%"
) else (
    echo       (curl nao encontrado, usando PowerShell)
    powershell -NoProfile -Command "Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile '%ZIP_PATH%'"
)
if errorlevel 1 (
    echo [ERRO] Falha ao baixar o ZIP.
    pause
    exit /b 1
)

echo [3/5] Extraindo arquivos...
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP_PATH%' -DestinationPath '%EXTRACT_DIR%' -Force"
if errorlevel 1 (
    echo [ERRO] Falha ao extrair o ZIP.
    pause
    exit /b 1
)

set "SRC_DIR=%EXTRACT_DIR%\robo-alvara-main"
if not exist "%SRC_DIR%" (
    echo [ERRO] Pasta esperada nao encontrada: robo-alvara-main
    pause
    exit /b 1
)

echo [4/5] Preservando config e documentos locais...
set "BACKUP_DIR=%WORK_DIR%\backup"
mkdir "%BACKUP_DIR%" 2>nul

if exist "%DEST%\config\config.json" (
    copy /Y "%DEST%\config\config.json" "%BACKUP_DIR%\config.json" >nul
    echo       - config.json salvo temporariamente
)

if exist "%DEST%\data\documentos" (
    echo       - data\documentos\ sera preservada (nao sobrescrita)
)

echo [5/5] Copiando arquivos atualizados...
robocopy "%SRC_DIR%" "%DEST%" /E /XD "data\documentos" "node_modules" ".git" /XF "config\config.json" /NFL /NDL /NJH /NJS /NC /NS /NP
set "ROBOCOPY_EXIT=%ERRORLEVEL%"
if %ROBOCOPY_EXIT% GEQ 8 (
    echo [ERRO] Falha ao copiar arquivos (robocopy codigo %ROBOCOPY_EXIT%).
    pause
    exit /b 1
)

if exist "%BACKUP_DIR%\config.json" (
    if not exist "%DEST%\config" mkdir "%DEST%\config"
    copy /Y "%BACKUP_DIR%\config.json" "%DEST%\config\config.json" >nul
    echo       - config.json restaurado
)

if exist "%WORK_DIR%" rmdir /S /Q "%WORK_DIR%" 2>nul

echo.
echo =======================================================
echo    ATUALIZACAO CONCLUIDA
echo =======================================================
echo.
echo Projeto atualizado em:
echo   %DEST%
echo.
echo PROXIMOS PASSOS:
echo   1) Abra a pasta acima no Explorer
echo   2) Rode exec\configurar-projeto-inicial.bat (se for 1a vez ou apos mudanca de deps)
echo   3) Confira config\config.json (chaveGemini, pastaDocumentos, etc.)
echo   4) Rode exec\executar.bat
echo.
pause
exit /b 0
