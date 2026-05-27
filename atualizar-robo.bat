@echo off
setlocal enabledelayedexpansion

REM ------------------------------------------------------------
REM Atualiza o repositório e commita automaticamente alteracoes BDD
REM Uso:
REM   atualizar-robo.bat
REM   atualizar-robo.bat "data\*BDD*.*"
REM ------------------------------------------------------------

cd /d "%~dp0"

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Esta pasta nao e um repositorio git.
    exit /b 1
)

echo [1/5] Atualizando branch local...
git pull --rebase
if errorlevel 1 (
    echo [ERRO] Falha no git pull --rebase.
    exit /b 1
)

echo [2/5] Adicionando arquivos alvo...
REM Sempre inclui prompt, pois ele faz parte da configuracao de triagem.
git add "config\prompt.txt" >nul 2>&1

REM Se voce passar um padrao no argumento, ele tambem sera adicionado.
if not "%~1"=="" (
    git add %1 >nul 2>&1
)

echo [3/5] Verificando se ha alteracoes staged...
git diff --cached --quiet
if not errorlevel 1 (
    echo [INFO] Nenhuma alteracao para commit nos arquivos alvo.
    exit /b 0
)

echo [4/5] Criando commit automatico...
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"`) do set "NOW=%%i"
if "%NOW%"=="" set "NOW=%date% %time%"

git commit -m "chore: atualiza arquivos BDD automaticamente (%NOW%)"
if errorlevel 1 (
    echo [ERRO] Falha ao criar commit.
    exit /b 1
)

echo [5/5] Enviando para remoto...
git push
if errorlevel 1 (
    echo [ERRO] Falha no git push.
    exit /b 1
)

echo [OK] Atualizacao e commit concluidos com sucesso.
exit /b 0
