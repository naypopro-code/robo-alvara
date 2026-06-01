@echo off
setlocal enabledelayedexpansion
set "EXIT_CODE=0"
title Atualizar Robo Alvara
color 0B

REM =======================================================
REM  Configuracao (repo publico - download direto do ZIP)
REM =======================================================
set "ZIP_URL=https://github.com/naypopro-code/robo-alvara/archive/refs/heads/main.zip"
set "ZIP_NAME=robo-alvara-main.zip"
set "WORK_DIR=%TEMP%\robo-alvara-update"
set "EXTRACT_DIR=%WORK_DIR%\extract"
set "ZIP_PATH=%WORK_DIR%\%ZIP_NAME%"
set "LOG_FILE="

pushd "%~dp0.."
set "PROJECT_ROOT=%CD%"
set "DEFAULT_DEST=%CD%"
popd

REM Limpando e capturando argumentos de forma segura
set "ARG_DEST="
set "ARG_ZIP="
set "LOCAL_ZIP="

if "%~1" NEQ "" set "ARG_DEST=%~1"
if "%~2" NEQ "" set "ARG_ZIP=%~2"

set "DEST=%DEFAULT_DEST%"
if defined ARG_DEST set "DEST=%ARG_DEST%"

if defined ARG_ZIP (
    echo %ARG_ZIP% | findstr /R /I "^https\?://" >nul
    if !ERRORLEVEL!==0 (
        set "ZIP_URL=%ARG_ZIP%"
    ) else (
        set "LOCAL_ZIP=%ARG_ZIP%"
    )
)

echo.
echo =======================================================
echo     ATUALIZAR ROBO ALVARA
echo =======================================================
echo.
echo Baixa a versao mais recente e atualiza os arquivos.
echo Preserva: config\config.json, data\documentos\, node-v*-win-x64\
echo.
echo Pasta padrao de destino:
echo    %DEST%
echo.
set /p "DEST_INPUT=Pasta de destino (Enter = padrao): "
if not "%DEST_INPUT%"=="" set "DEST=%DEST_INPUT%"

echo.
echo Destino confirmado: %DEST%
set /p "CONFIRM=Continuar? (S/N) [S]: "
if /I "%CONFIRM%"=="N" (
    echo [LOG] Operacao cancelada pelo usuario.
    goto :finalizar
)

if not exist "%DEST%\logs" mkdir "%DEST%\logs" 2>nul
for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "LOG_STAMP=%%T"
set "LOG_FILE=%DEST%\logs\atualizacao-%LOG_STAMP%.log"

echo [LOG] ========== INICIO DA ATUALIZACAO ==========
echo [LOG] Origem do script: %~f0
echo [LOG] Pasta do projeto local: %PROJECT_ROOT%
echo [LOG] Pasta de destino: %DEST%

REM --- [1/5] Destino ---
echo [LOG] [1/5] Verificando pasta de destino...
if not exist "%DEST%" (
    echo [LOG]        Pasta nao existe. Criando: %DEST%
    mkdir "%DEST%" 2>nul
    if errorlevel 1 (
        echo [LOG] ERRO: Nao foi possivel criar a pasta de destino.
        set "EXIT_CODE=1"
        goto :finalizar
    )
    echo [LOG]        Pasta criada com sucesso.
) else (
    echo [LOG]        Pasta de destino OK.
)

REM --- [2/5] Area temporaria ---
echo [LOG] [2/5] Preparando area temporaria...
if exist "%WORK_DIR%" (
    rmdir /S /Q "%WORK_DIR%" 2>nul
)
mkdir "%WORK_DIR%" 2>nul
mkdir "%EXTRACT_DIR%" 2>nul
if not exist "%WORK_DIR%" (
    echo [LOG] ERRO: Nao foi possivel criar area temporaria.
    set "EXIT_CODE=1"
    goto :finalizar
)

REM --- [3/5] Download / ZIP local ---
echo [LOG] [3/5] Obtendo pacote de codigo...
echo [LOG]        Iniciando download via PowerShell...
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile '%ZIP_PATH%' -ErrorAction Stop; Write-Output 'Download concluido com sucesso via PS.' } catch { Write-Error $_.Exception.Message; exit 1 }"

if not exist "%ZIP_PATH%" (
    echo [LOG] ERRO: O arquivo ZIP nao foi gerado em: %ZIP_PATH%
    set "EXIT_CODE=1"
    goto :finalizar
)

REM --- [4/5] Extracao e backup ---
echo [LOG] [4/5] Extraindo arquivos...
powershell -NoProfile -Command "try { Expand-Archive -Path '%ZIP_PATH%' -DestinationPath '%EXTRACT_DIR%' -Force } catch { Write-Error $_.Exception.Message; exit 1 }"

REM Mapeamento da pasta extraida de forma direta
set "SRC_DIR="
for /d %%D in ("%EXTRACT_DIR%\*") do set "SRC_DIR=%%D"

if not defined SRC_DIR (
    if exist "%EXTRACT_DIR%\package.json" (
        set "SRC_DIR=%EXTRACT_DIR%"
    )
)

if not defined SRC_DIR (
    echo [LOG] ERRO: Nao foi possivel encontrar a pasta extraida.
    set "EXIT_CODE=1"
    goto :finalizar
)

echo [LOG]        Pasta de origem identificada: !SRC_DIR!

set "BACKUP_DIR=%WORK_DIR%\backup"
mkdir "%BACKUP_DIR%" 2>nul

if exist "%DEST%\config\config.json" (
    copy /Y "%DEST%\config\config.json" "%BACKUP_DIR%\config.json" >nul
    echo [LOG]        - config.json salvo temporariamente
)

REM --- [5/5] Copia ---
echo [LOG] [5/5] Copiando arquivos atualizados...
robocopy "!SRC_DIR!" "%DEST%" /E /XD "data\documentos" "node_modules" /XF "config\config.json" /NFL /NDL /NJH /NJS /NC /NS /NP
set "ROBOCOPY_EXIT=!ERRORLEVEL!"

if !ROBOCOPY_EXIT! GEQ 8 (
    echo [LOG] ERRO: Falha ao copiar arquivos pelo Robocopy.
    set "EXIT_CODE=1"
    goto :finalizar
)

if exist "%BACKUP_DIR%\config.json" (
    if not exist "%DEST%\config" mkdir "%DEST%\config"
    copy /Y "%BACKUP_DIR%\config.json" "%DEST%\config\config.json" >nul
    echo [LOG]        - config.json restaurado com sucesso.
)

echo [LOG]        Limpando area temporaria...
if exist "%WORK_DIR%" rmdir /S /Q "%WORK_DIR%" 2>nul

echo.
echo =======================================================
if "%EXIT_CODE%"=="0" (
    echo     ATUALIZACAO CONCLUIDA COM SUCESSO!
) else (
    echo     ATUALIZACAO FINALIZADA COM ERROS
)
echo =======================================================
echo.
goto :finalizar

:finalizar
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
endlocal & exit %EXIT_CODE%
