@echo off
setlocal
pushd "%~dp0.."
set "PROJECT_ROOT=%CD%"

set "GIT_VERSION=2.49.0"
set "GIT_DIRNAME=MinGit-%GIT_VERSION%-64-bit"
set "GIT_ZIP=%GIT_DIRNAME%.zip"
set "GIT_URL=https://github.com/git-for-windows/git/releases/download/v%GIT_VERSION%.windows.1/%GIT_ZIP%"
set "GIT_DIR=%PROJECT_ROOT%\%GIT_DIRNAME%"
set "GIT_EXE=%GIT_DIR%\cmd\git.exe"

if exist "%GIT_EXE%" (
    echo [GIT] Git portable ja presente em %GIT_DIRNAME%\ - pulando download.
    popd
    endlocal
    exit /b 0
)

echo [GIT] Baixando Git portable %GIT_VERSION% ...
echo       %GIT_URL%

where curl >nul 2>nul
if %ERRORLEVEL%==0 (
    curl -L --fail -o "%GIT_ZIP%" "%GIT_URL%"
) else (
    echo       (curl nao encontrado, usando PowerShell)
    powershell -NoProfile -Command "Invoke-WebRequest -Uri '%GIT_URL%' -OutFile '%GIT_ZIP%'"
)
if errorlevel 1 (
    echo [ERRO] Falha ao baixar Git portable.
    popd
    endlocal
    exit /b 1
)

echo [GIT] Extraindo %GIT_ZIP% ...
powershell -NoProfile -Command "Expand-Archive -Path '%GIT_ZIP%' -DestinationPath '.' -Force"
if errorlevel 1 (
    echo [ERRO] Falha ao extrair Git portable.
    popd
    endlocal
    exit /b 1
)

del /Q "%GIT_ZIP%" 2>nul

if not exist "%GIT_EXE%" (
    echo [ERRO] git.exe nao encontrado em %GIT_DIR%\cmd\ apos extracao.
    popd
    endlocal
    exit /b 1
)

echo [GIT] Git portable instalado em %GIT_DIRNAME%\
popd
endlocal
exit /b 0
