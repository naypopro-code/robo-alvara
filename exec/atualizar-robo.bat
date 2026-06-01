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

set "ARG_DEST=%~1"
set "ARG_ZIP=%~2"
set "LOCAL_ZIP="
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
echo    ATUALIZAR ROBO ALVARA
echo =======================================================
echo.
echo Baixa a versao mais recente e atualiza os arquivos.
echo Preserva: config\config.json, data\documentos\, node-v*-win-x64\
echo.
echo Pasta padrao de destino:
echo   %DEST%
echo.
set /p "DEST_INPUT=Pasta de destino (Enter = padrao): "
if not "%DEST_INPUT%"=="" set "DEST=%DEST_INPUT%"

echo.
echo Destino confirmado: %DEST%
set /p "CONFIRM=Continuar? (S/N) [S]: "
if /I "%CONFIRM%"=="N" (
    call :log "Operacao cancelada pelo usuario."
    goto :finalizar
)

if not exist "%DEST%\logs" mkdir "%DEST%\logs" 2>nul
for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "LOG_STAMP=%%T"
set "LOG_FILE=%DEST%\logs\atualizacao-%LOG_STAMP%.log"

call :log "========== INICIO DA ATUALIZACAO =========="
call :log "Origem do script: %~f0"
call :log "Pasta do projeto local: %PROJECT_ROOT%"
call :log "Pasta de destino: %DEST%"
if defined LOCAL_ZIP (
    call :log "Modo: ZIP local (%LOCAL_ZIP%)"
) else (
    call :log "Modo: download da URL"
    call :log "URL: %ZIP_URL%"
)

REM --- [1/5] Destino ---
call :log "[1/5] Verificando pasta de destino..."
if not exist "%DEST%" (
    call :log "       Pasta nao existe. Criando: %DEST%"
    mkdir "%DEST%" 2>nul
    if errorlevel 1 (
        call :log "ERRO: Nao foi possivel criar a pasta de destino."
        set "EXIT_CODE=1"
        goto :finalizar
    )
    call :log "       Pasta criada com sucesso."
) else (
    call :log "       Pasta de destino OK."
)

REM --- [2/5] Area temporaria ---
call :log "[2/5] Preparando area temporaria..."
call :log "       WORK_DIR=%WORK_DIR%"
if exist "%WORK_DIR%" (
    call :log "       Removendo area temporaria anterior..."
    rmdir /S /Q "%WORK_DIR%" 2>nul
)
mkdir "%WORK_DIR%" 2>nul
mkdir "%EXTRACT_DIR%" 2>nul
if not exist "%WORK_DIR%" (
    call :log "ERRO: Nao foi possivel criar area temporaria."
    set "EXIT_CODE=1"
    goto :finalizar
)
call :log "       Area temporaria pronta."

REM --- [3/5] Download / ZIP local ---
call :log "[3/5] Obtendo pacote de codigo..."
if defined LOCAL_ZIP (
    call :log "       Usando arquivo local: %LOCAL_ZIP%"
    if not exist "%LOCAL_ZIP%" (
        call :log "ERRO: Arquivo ZIP local nao encontrado."
        set "EXIT_CODE=1"
        goto :finalizar
    )
    copy /Y "%LOCAL_ZIP%" "%ZIP_PATH%" >nul
    if errorlevel 1 (
        call :log "ERRO: Falha ao copiar ZIP local para area temporaria."
        set "EXIT_CODE=1"
        goto :finalizar
    )
    call :log "       ZIP local copiado para %ZIP_PATH%"
) else (
    call :log "       Iniciando download..."
    where curl >nul 2>nul
    if !ERRORLEVEL!==0 (
        call :log "       Ferramenta: curl"
        curl -L --fail -o "%ZIP_PATH%" "%ZIP_URL%"
    ) else (
        call :log "       Ferramenta: PowerShell Invoke-WebRequest"
        powershell -NoProfile -Command "Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile '%ZIP_PATH%'"
    )
    if errorlevel 1 (
        call :log "ERRO: Falha ao baixar o ZIP."
        call :log "       Verifique a conexao com a internet e a URL: %ZIP_URL%"
        call :log "       Alternativa: baixe o ZIP manualmente e rode:"
        call :log "       exec\atualizar-robo.bat \"%DEST%\" \"C:\caminho\robo-alvara-main.zip\""
        set "EXIT_CODE=1"
        goto :finalizar
    )
    call :log "       Download concluido."
)

if not exist "%ZIP_PATH%" (
    call :log "ERRO: ZIP nao encontrado apos obtencao do pacote."
    set "EXIT_CODE=1"
    goto :finalizar
)
for %%F in ("%ZIP_PATH%") do call :log "       Arquivo: %%~nxF (%%~zF bytes)"

REM --- [4/5] Extracao e backup ---
call :log "[4/5] Extraindo arquivos..."
call :log "       Origem: %ZIP_PATH%"
call :log "       Destino: %EXTRACT_DIR%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP_PATH%' -DestinationPath '%EXTRACT_DIR%' -Force"
if errorlevel 1 (
    call :log "ERRO: Falha ao extrair o ZIP."
    set "EXIT_CODE=1"
    goto :finalizar
)
call :log "       Extracao concluida."

set "SRC_DIR="
for /d %%D in ("%EXTRACT_DIR%\robo-alvara-*") do set "SRC_DIR=%%D"
if not defined SRC_DIR (
    call :log "ERRO: Pasta extraida nao encontrada (esperado robo-alvara-*)."
    set "EXIT_CODE=1"
    goto :finalizar
)
call :log "       Pasta extraida: %SRC_DIR%"

set "BACKUP_DIR=%WORK_DIR%\backup"
mkdir "%BACKUP_DIR%" 2>nul
call :log "       Preservando arquivos locais..."

if exist "%DEST%\config\config.json" (
    copy /Y "%DEST%\config\config.json" "%BACKUP_DIR%\config.json" >nul
    call :log "       - config.json salvo em backup temporario"
) else (
    call :log "       - config.json nao encontrado (nada a preservar)"
)

if exist "%DEST%\data\documentos" (
    call :log "       - data\documentos\ sera preservada (nao sobrescrita)"
) else (
    call :log "       - data\documentos\ nao existe ainda"
)

REM --- [5/5] Copia ---
call :log "[5/5] Copiando arquivos atualizados..."
call :log "       Origem: %SRC_DIR%"
call :log "       Destino: %DEST%"
robocopy "%SRC_DIR%" "%DEST%" /E /XD "data\documentos" "node_modules" /XF "config\config.json" /NFL /NDL /NJH /NJS /NC /NS /NP
set "ROBOCOPY_EXIT=!ERRORLEVEL!"
call :log "       Robocopy finalizado (codigo !ROBOCOPY_EXIT!)."
if !ROBOCOPY_EXIT! GEQ 8 (
    call :log "ERRO: Falha ao copiar arquivos."
    set "EXIT_CODE=1"
    goto :finalizar
)

if exist "%BACKUP_DIR%\config.json" (
    if not exist "%DEST%\config" mkdir "%DEST%\config"
    copy /Y "%BACKUP_DIR%\config.json" "%DEST%\config\config.json" >nul
    call :log "       - config.json restaurado"
)

call :log "       Limpando area temporaria..."
if exist "%WORK_DIR%" rmdir /S /Q "%WORK_DIR%" 2>nul
call :log "       Limpeza concluida."

echo.
echo =======================================================
if "%EXIT_CODE%"=="0" (
    echo    ATUALIZACAO CONCLUIDA
) else (
    echo    ATUALIZACAO COM ERROS
)
echo =======================================================
echo.
echo Projeto atualizado em:
echo   %DEST%
echo.
echo Log salvo em:
echo   %LOG_FILE%
echo.
echo PROXIMOS PASSOS:
echo   1) Rode exec\configurar-projeto-inicial.bat (se necessario)
echo   2) Confira config\config.json
echo   3) Rode exec\executar.bat
echo.
call :log "========== FIM DA ATUALIZACAO (codigo %EXIT_CODE%) =========="
goto :finalizar

:log
set "MSG=%~1"
echo [LOG] !MSG!
if defined LOG_FILE >>"%LOG_FILE%" echo [%date% %time%] !MSG!
exit /b 0

:finalizar
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
endlocal & exit %EXIT_CODE%
