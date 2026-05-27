@echo off
setlocal enabledelayedexpansion

REM ------------------------------------------------------------
REM Atualiza o repositorio e commita automaticamente alteracoes BDD
REM Usa Git portable (MinGit) na raiz do projeto.
REM Uso:
REM   atualizar-robo.bat
REM   atualizar-robo.bat "data\*BDD*.*"
REM ------------------------------------------------------------

pushd "%~dp0.."
set "PROJECT_ROOT=%CD%"

set "GIT_VERSION=2.49.0"
set "GIT_DIRNAME=MinGit-%GIT_VERSION%-64-bit"
set "GIT_DIR=%PROJECT_ROOT%\%GIT_DIRNAME%"
set "GIT_EXE=%GIT_DIR%\cmd\git.exe"

if not exist "%GIT_EXE%" (
    echo [ERRO] Git portable nao encontrado em %GIT_DIRNAME%\cmd\git.exe
    echo        Rode exec\baixar-git.bat ou exec\configurar-projeto-inicial.bat
    popd
    exit /b 1
)

set "PATH=%GIT_DIR%\cmd;%GIT_DIR%\mingw64\bin;%PATH%"

"%GIT_EXE%" rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Esta pasta nao e um repositorio git.
    popd
    exit /b 1
)

echo [1/5] Atualizando branch local...
"%GIT_EXE%" pull --rebase
if errorlevel 1 (
    echo [ERRO] Falha no git pull --rebase.
    popd
    exit /b 1
)

echo [2/5] Adicionando arquivos alvo...
REM Sempre inclui prompt, pois ele faz parte da configuracao de triagem.
"%GIT_EXE%" add "config\prompt.txt" >nul 2>&1

REM Se voce passar um padrao no argumento, ele tambem sera adicionado.
if not "%~1"=="" (
    "%GIT_EXE%" add %1 >nul 2>&1
)

echo [3/5] Verificando se ha alteracoes staged...
"%GIT_EXE%" diff --cached --quiet
if not errorlevel 1 (
    echo [INFO] Nenhuma alteracao para commit nos arquivos alvo.
    popd
    exit /b 0
)

echo [4/5] Criando commit automatico...
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"`) do set "NOW=%%i"
if "!NOW!"=="" set "NOW=%date% %time%"

"%GIT_EXE%" commit -m "chore: atualiza arquivos BDD automaticamente (!NOW!)"
if errorlevel 1 (
    echo [ERRO] Falha ao criar commit.
    popd
    exit /b 1
)

echo [5/5] Enviando para remoto...
"%GIT_EXE%" push
if errorlevel 1 (
    echo [ERRO] Falha no git push.
    popd
    exit /b 1
)

echo [OK] Atualizacao e commit concluidos com sucesso.
popd
exit /b 0
