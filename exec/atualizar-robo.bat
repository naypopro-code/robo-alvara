@echo off
setlocal enabledelayedexpansion
set "EXIT_CODE=0"
title Atualizar Robo Alvara (GitHub ZIP)
color 0B

echo.
echo =======================================================
echo    ATUALIZAR ROBO ALVARA - DOWNLOAD GITHUB
echo =======================================================
echo.

pushd "%~dp0.."
set "PROJECT_ROOT=%CD%"
popd

REM --- Argumentos: [pastaDestino] [caminhoZipLocal ou zipUrl] ---
set "ARG_DEST=%~1"
set "ARG_ZIP=%~2"

REM --- Defaults ---
set "DEFAULT_DEST=C:\Users\nayarapb\Documents\Teste_Robo_EAA_DVS\robo-alvara-main"
set "GITHUB_OWNER=naypopro-code"
set "GITHUB_REPO=robo-alvara"
set "GITHUB_BRANCH=main"
set "ZIP_URL="
set "LOCAL_ZIP="

REM --- Ler config\atualizacao.json se existir ---
set "CFG_ATUALIZACAO=%PROJECT_ROOT%\config\atualizacao.json"
if exist "%CFG_ATUALIZACAO%" (
    for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command ^
        "$c=Get-Content '%CFG_ATUALIZACAO%' -Raw | ConvertFrom-Json; ^
        if($c.destinoPadrao){Write-Output ('DEST='+$c.destinoPadrao)}; ^
        if($c.zipUrl){Write-Output ('ZIPURL='+$c.zipUrl)}; ^
        if($c.github.owner){Write-Output ('OWNER='+$c.github.owner)}; ^
        if($c.github.repo){Write-Output ('REPO='+$c.github.repo)}; ^
        if($c.github.branch){Write-Output ('BRANCH='+$c.github.branch)}"`) do (
        set "%%A"
    )
)

if not defined DEST set "DEST=%DEFAULT_DEST%"
if defined ARG_DEST set "DEST=%ARG_DEST%"

if not defined ZIPURL (
    set "ZIPURL=https://github.com/%GITHUB_OWNER%/%GITHUB_REPO%/archive/refs/heads/%GITHUB_BRANCH%.zip"
)

if defined ARG_ZIP (
    echo %ARG_ZIP% | findstr /R /I "^https\?://" >nul
    if !ERRORLEVEL!==0 (
        set "ZIPURL=%ARG_ZIP%"
    ) else (
        set "LOCAL_ZIP=%ARG_ZIP%"
    )
)

set "ZIP_NAME=robo-alvara-%GITHUB_BRANCH%.zip"
set "WORK_DIR=%TEMP%\robo-alvara-update"
set "EXTRACT_DIR=%WORK_DIR%\extract"
set "FOLDER_EXTRACT=robo-alvara-%GITHUB_BRANCH%"

echo Este script baixa a versao mais recente e atualiza os arquivos.
echo Itens preservados: config\config.json, data\documentos\, node-v*-win-x64\
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
    echo [INFO] Operacao cancelada.
    goto :finalizar
)

if not exist "%DEST%" (
    echo.
    echo [INFO] Pasta nao existe. Criando: %DEST%
    mkdir "%DEST%" 2>nul
    if errorlevel 1 (
        echo [ERRO] Nao foi possivel criar a pasta de destino.
        set "EXIT_CODE=1"
        goto :finalizar
    )
)

echo.
echo [1/5] Preparando area temporaria...
if exist "%WORK_DIR%" rmdir /S /Q "%WORK_DIR%" 2>nul
mkdir "%WORK_DIR%" 2>nul
mkdir "%EXTRACT_DIR%" 2>nul

set "ZIP_PATH=%WORK_DIR%\%ZIP_NAME%"

echo [2/5] Obtendo pacote de codigo...
if defined LOCAL_ZIP (
    echo       Usando ZIP local: %LOCAL_ZIP%
    if not exist "%LOCAL_ZIP%" (
        echo [ERRO] Arquivo ZIP local nao encontrado.
        set "EXIT_CODE=1"
        goto :finalizar
    )
    copy /Y "%LOCAL_ZIP%" "%ZIP_PATH%" >nul
) else (
    echo       URL: %ZIPURL%
    if defined GITHUB_TOKEN (
        echo       Usando GITHUB_TOKEN para repositorio privado.
        where curl >nul 2>nul
        if !ERRORLEVEL!==0 (
            curl -L --fail -H "Authorization: Bearer %GITHUB_TOKEN%" -o "%ZIP_PATH%" "%ZIPURL%"
        ) else (
            powershell -NoProfile -Command ^
                "$h=@{Authorization='Bearer %GITHUB_TOKEN%'}; Invoke-WebRequest -Uri '%ZIPURL%' -Headers $h -OutFile '%ZIP_PATH%'"
        )
    ) else (
        where curl >nul 2>nul
        if !ERRORLEVEL!==0 (
            curl -L --fail -o "%ZIP_PATH%" "%ZIPURL%"
        ) else (
            powershell -NoProfile -Command "Invoke-WebRequest -Uri '%ZIPURL%' -OutFile '%ZIP_PATH%'"
        )
    )
    if errorlevel 1 (
        echo.
        echo [ERRO] Falha ao baixar o ZIP.
        echo.
        echo Causas comuns do erro 404:
        echo   1) Repositorio ainda nao foi publicado no GitHub
        echo   2) Repositorio e PRIVADO - defina a variavel GITHUB_TOKEN
        echo   3) URL ou branch incorretos em config\atualizacao.json
        echo.
        echo Solucoes:
        echo   A) Torne o repo publico: github.com/%GITHUB_OWNER%/%GITHUB_REPO%
        echo   B) Repo privado - no CMD antes de rodar:
        echo        set GITHUB_TOKEN=seu_token_github
        echo        exec\atualizar-robo.bat
        echo   C) Baixe o ZIP manualmente no GitHub e rode:
        echo        exec\atualizar-robo.bat "%DEST%" "C:\caminho\robo-alvara-main.zip"
        echo.
        set "EXIT_CODE=1"
        goto :finalizar
    )
)

if not exist "%ZIP_PATH%" (
    echo [ERRO] ZIP nao encontrado apos download.
    set "EXIT_CODE=1"
    goto :finalizar
)

echo [3/5] Extraindo arquivos...
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP_PATH%' -DestinationPath '%EXTRACT_DIR%' -Force"
if errorlevel 1 (
    echo [ERRO] Falha ao extrair o ZIP.
    set "EXIT_CODE=1"
    goto :finalizar
)

set "SRC_DIR="
for /d %%D in ("%EXTRACT_DIR%\robo-alvara-*") do set "SRC_DIR=%%D"
if not defined SRC_DIR (
    echo [ERRO] Pasta extraida nao encontrada (esperado robo-alvara-*).
    set "EXIT_CODE=1"
    goto :finalizar
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
set "ROBOCOPY_EXIT=!ERRORLEVEL!"
if !ROBOCOPY_EXIT! GEQ 8 (
    echo [ERRO] Falha ao copiar arquivos (robocopy codigo !ROBOCOPY_EXIT!).
    set "EXIT_CODE=1"
    goto :finalizar
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
echo   1) Rode exec\configurar-projeto-inicial.bat (se necessario)
echo   2) Confira config\config.json
echo   3) Rode exec\executar.bat
echo.
goto :finalizar

:finalizar
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
endlocal & exit %EXIT_CODE%
