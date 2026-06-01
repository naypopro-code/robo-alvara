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

REM Identifica os caminhos locais
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR%"=="" set "SCRIPT_DIR=%CD%\"
set "SCRIPT_NAME=%~nx0"
set "SCRIPT_SELF=%SCRIPT_DIR%%SCRIPT_NAME%"

pushd "%SCRIPT_DIR%.."
set "PROJECT_ROOT=%CD%"
set "DEFAULT_DEST=%CD%"
popd

set "DEST=%DEFAULT_DEST%"

echo.
echo =======================================================
echo     ATUALIZAR ROBO ALVARA (PROTECAO EXCL_EXEC)
echo =======================================================
echo.
echo Baixa a versao mais recente e atualiza os arquivos.
echo Preserva: config\config.json, data\documentos\, exec\
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

echo [LOG] ========== INICIO DA ATUALIZACAO ==========

REM --- [1/5] Destino ---
echo [LOG] [1/5] Verificando pasta de destino...
if not exist "%DEST%" mkdir "%DEST%" 2>nul

REM --- [2/5] Area temporaria ---
echo [LOG] [2/5] Preparando area temporaria...
if exist "%WORK_DIR%" rmdir /S /Q "%WORK_DIR%" 2>nul
mkdir "%WORK_DIR%" 2>nul
mkdir "%EXTRACT_DIR%" 2>nul

set "BACKUP_DIR=%WORK_DIR%\backup"
mkdir "%BACKUP_DIR%" 2>nul

REM --- [3/5] Download ---
echo [LOG] [3/5] Obtendo pacote de codigo...
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile '%ZIP_PATH%' -ErrorAction Stop; Write-Output 'Download concluido com sucesso via PS.' } catch { Write-Error $_.Exception.Message; exit 1 }"

if not exist "%ZIP_PATH%" (
    echo [LOG] ERRO: O arquivo ZIP nao foi gerado.
    set "EXIT_CODE=1"
    goto :finalizar
)

REM --- [4/5] Extracao ---
echo [LOG] [4/5] Extraindo arquivos...
powershell -NoProfile -Command "try { if (Test-Path '%EXTRACT_DIR%') { Remove-Item -Path '%EXTRACT_DIR%' -Recurse -Force -ErrorAction SilentlyContinue }; Expand-Archive -Path '%ZIP_PATH%' -DestinationPath '%EXTRACT_DIR%' -ErrorAction Stop } catch { Write-Error $_.Exception.Message; exit 1 }"

set "SRC_DIR="
for /d %%D in ("%EXTRACT_DIR%\*") do set "SRC_DIR=%%D"
if not defined SRC_DIR (
    if exist "%EXTRACT_DIR%\package.json" set "SRC_DIR=%EXTRACT_DIR%"
)

if not defined SRC_DIR (
    echo [LOG] ERRO: Nao foi possivel encontrar a pasta extraida.
    set "EXIT_CODE=1"
    goto :finalizar
)

REM Preserva o config.json local se ele existir
if exist "%DEST%\config\config.json" (
    copy /Y "%DEST%\config\config.json" "%BACKUP_DIR%\config.json" >nul
)

REM --- [5/5] Copia com blindagem de pastas ---
echo [LOG] [5/5] Copiando arquivos atualizados...

REM Mudança crucial aqui: Adicionado "exec" na lista de exclusão (/XD) do Robocopy.
REM Isso impede o Robocopy de mexer na pasta onde este script reside.
robocopy "!SRC_DIR!" "%DEST%" /E /XD "data\documentos" "node_modules" "exec" /XF "config\config.json" /NFL /NDL /NJH /NJS /NC /NS /NP
set "ROBOCOPY_EXIT=!ERRORLEVEL!"

if !ROBOCOPY_EXIT! GEQ 8 (
    echo [LOG] ERRO: Falha ao copiar arquivos pelo Robocopy.
    set "EXIT_CODE=1"
    goto :finalizar
)

REM --- RESTAURAÇÃO DOS ARQUIVOS SALVOS ---
if exist "%BACKUP_DIR%\config.json" (
    if not exist "%DEST%\config" mkdir "%DEST%\config"
    copy /Y "%BACKUP_DIR%\config.json" "%DEST%\config\config.json" >nul
    echo [LOG]        - config.json restaurado.
)

echo.
echo =======================================================
echo     ATUALIZACAO CONCLUIDA COM SUCESSO!
echo =======================================================
echo.

REM Limpeza final do zip temporário
if exist "%ZIP_PATH%" del /F /Q "%ZIP_PATH%" 2>nul
goto :finalizar

:finalizar
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
endlocal & exit %EXIT_CODE%
