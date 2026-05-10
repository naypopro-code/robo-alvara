@echo off
title Executando Triagem EAA-DVS
color 0B
echo.
echo =======================================================
echo           INICIANDO ROBO DE TRIAGEM EAA-DVS
echo =======================================================
echo.

:: Define o caminho direto para o seu executável do Node
set "NODE_EXE=C:\Users\nayarapb\Documents\Teste_Robo_EAA_DVS\node-v25.9.0-win-x64\node.exe"

echo [INFO] Entrando na pasta do projeto...
cd /d "C:\Users\nayarapb\Documents\Teste_Robo_EAA_DVS"

echo [INFO] Verificando executavel em: %NODE_EXE%
if not exist "%NODE_EXE%" (
    echo [ERRO] O executavel do Node nao foi encontrado no caminho especificado.
    echo Verifique se a pasta node-v25.9.0-win-x64 esta correta.
    pause
    exit
)

echo [INFO] Executando main.js...
echo.
"%NODE_EXE%" main.js

echo.
echo =======================================================
echo              PROCESSAMENTO CONCLUIDO!
echo =======================================================
echo.
echo Pressione qualquer tecla para fechar esta janela.
pause > nul