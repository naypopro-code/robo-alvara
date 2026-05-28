@echo off
setlocal enabledelayedexpansion
title Configurar Git e SSH (GitHub)
color 0B

echo.
echo =======================================================
echo      CONFIGURAR GIT + SSH PARA GITHUB (PUSH)
echo =======================================================
echo.

pushd "%~dp0.."
set "PROJECT_ROOT=%CD%"

set "GIT_VERSION=2.49.0"
set "GIT_DIRNAME=MinGit-%GIT_VERSION%-64-bit"
set "GIT_DIR=%PROJECT_ROOT%\%GIT_DIRNAME%"
set "GIT_EXE=%GIT_DIR%\cmd\git.exe"
set "SSH_KEYGEN=%GIT_DIR%\usr\bin\ssh-keygen.exe"
set "SSH_AGENT=%GIT_DIR%\usr\bin\ssh-agent.exe"
set "SSH_ADD=%GIT_DIR%\usr\bin\ssh-add.exe"
set "HOME_DIR=%USERPROFILE%"
set "SSH_DIR=%HOME_DIR%\.ssh"
set "KEY_PATH=%SSH_DIR%\id_ed25519"
set "PUB_KEY=%KEY_PATH%.pub"

if not exist "%GIT_EXE%" (
    echo [ERRO] Git portable nao encontrado em:
    echo        %GIT_EXE%
    echo.
    echo Rode primeiro: exec\baixar-git.bat
    popd
    pause
    exit /b 1
)

set "PATH=%GIT_DIR%\cmd;%GIT_DIR%\usr\bin;%GIT_DIR%\mingw64\bin;%PATH%"

echo [1/6] Configuracao basica do Git...
set /p "GIT_USER_NAME=Digite seu nome para commits (ex: Joao Silva): "
set /p "GIT_USER_EMAIL=Digite seu email do GitHub: "

if "%GIT_USER_NAME%"=="" (
    echo [ERRO] Nome nao pode ficar vazio.
    popd
    pause
    exit /b 1
)
if "%GIT_USER_EMAIL%"=="" (
    echo [ERRO] Email nao pode ficar vazio.
    popd
    pause
    exit /b 1
)

"%GIT_EXE%" config --global user.name "%GIT_USER_NAME%"
if errorlevel 1 (
    echo [ERRO] Falha ao configurar user.name
    popd
    pause
    exit /b 1
)

"%GIT_EXE%" config --global user.email "%GIT_USER_EMAIL%"
if errorlevel 1 (
    echo [ERRO] Falha ao configurar user.email
    popd
    pause
    exit /b 1
)

echo [OK] user.name e user.email configurados.

echo.
echo [2/6] Preparando pasta .ssh ...
if not exist "%SSH_DIR%" mkdir "%SSH_DIR%"

echo.
echo [3/6] Gerando chave SSH ed25519...
if exist "%KEY_PATH%" (
    echo [INFO] Chave ja existe em %KEY_PATH%
    set /p "REGERAR=Deseja gerar nova chave e sobrescrever? (s/N): "
    if /I "!REGERAR!"=="S" (
        del /Q "%KEY_PATH%" >nul 2>&1
        del /Q "%PUB_KEY%" >nul 2>&1
    )
)

if not exist "%KEY_PATH%" (
    "%SSH_KEYGEN%" -t ed25519 -C "%GIT_USER_EMAIL%" -f "%KEY_PATH%" -N ""
    if errorlevel 1 (
        echo [ERRO] Falha ao gerar chave SSH.
        popd
        pause
        exit /b 1
    )
)

if not exist "%PUB_KEY%" (
    echo [ERRO] Chave publica nao encontrada: %PUB_KEY%
    popd
    pause
    exit /b 1
)

echo [OK] Chave publica gerada: %PUB_KEY%

echo.
echo [4/6] Iniciando ssh-agent e adicionando chave...
for /f "tokens=1,2 delims==" %%A in ('"%SSH_AGENT%" -s ^| findstr /R "SSH_AUTH_SOCK SSH_AGENT_PID"') do (
    set "%%A=%%B"
)

if not "%SSH_AUTH_SOCK%"=="" (
    set "SSH_AUTH_SOCK=%SSH_AUTH_SOCK:;=%"
)
if not "%SSH_AGENT_PID%"=="" (
    set "SSH_AGENT_PID=%SSH_AGENT_PID:;=%"
)

"%SSH_ADD%" "%KEY_PATH%"
if errorlevel 1 (
    echo [WARN] Nao foi possivel adicionar a chave no agent agora.
    echo       Voce ainda pode usar a chave normalmente no Windows.
) else (
    echo [OK] Chave adicionada ao ssh-agent.
)

echo.
echo [5/6] Copiando chave publica para a area de transferencia...
type "%PUB_KEY%" | clip
if errorlevel 1 (
    echo [WARN] Nao foi possivel copiar automaticamente para o clipboard.
    echo       Abra o arquivo e copie manualmente:
    echo       %PUB_KEY%
) else (
    echo [OK] Chave publica copiada para Ctrl+V.
)

echo.
echo [6/6] Passo a passo no GitHub:
echo.
echo   1) Abra: https://github.com/settings/keys
echo   2) Clique em "New SSH key"
echo   3) Title: ex. "Notebook Robo Alvara"
echo   4) Cole a chave (Ctrl+V) no campo Key
echo   5) Clique em "Add SSH key"
echo   6) Se pedir, confirme com sua senha/2FA
echo.
echo Teste da conexao SSH:
echo   "%GIT_DIR%\usr\bin\ssh.exe" -T git@github.com
echo.
echo Se o remoto ainda estiver HTTPS, troque para SSH:
echo   "%GIT_EXE%" remote -v
echo   "%GIT_EXE%" remote set-url origin git@github.com:SEU_USUARIO/SEU_REPO.git
echo.
echo Configuracao concluida.
echo.

popd
pause
endlocal
exit /b 0
