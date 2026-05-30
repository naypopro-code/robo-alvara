# Guia de atualização — Robô Alvará (para PO)

Este guia descreve como atualizar o robô no Windows **sem Git**. A atualização baixa o código direto do GitHub em formato ZIP.

---

## Pré-requisitos

- Windows com acesso à internet
- Permissão para gravar na pasta de instalação

---

## Passo a passo — primeira instalação

### 1. Baixar e extrair o projeto

1. Abra o Explorer e vá até a pasta onde o robô ficará instalado.
2. Pasta padrão recomendada:
   ```
   C:\Users\nayarapb\Documents\Teste_Robo_EAA_DVS
   ```
3. Execute (duplo clique):
   ```
   exec\atualizar-robo.bat
   ```
4. Quando aparecer **Pasta padrao de destino**, pressione **Enter** para aceitar o caminho padrão ou digite outro caminho.
5. Confirme com **S** quando perguntado **Continuar? (S/N)**.
6. Aguarde as etapas `[1/5]` até `[5/5]` concluírem.

### 2. Configurar ambiente (Node + dependências)

1. Na pasta do projeto, execute:
   ```
   exec\configurar-projeto-inicial.bat
   ```
2. O script vai:
   - Baixar Node.js portable (se necessário)
   - Rodar `npm install`
   - Criar `data\documentos\`
   - Criar `config\config.json` (se ainda não existir)

### 3. Configurar credenciais e caminhos

1. Abra `config\config.json` no Bloco de Notas.
2. Preencha pelo menos:
   - `integracao.chaveGemini` — chave da API Gemini
   - `integracao.urlPlanilha` — URL do Apps Script
   - `caminhos.pastaDocumentos` — pasta com as subpastas numeradas (ex.: `C:\...\01_documentos_alvara`)

### 4. Colocar os PDFs

1. Crie subpastas numeradas dentro de `pastaDocumentos` (ex.: `252`, `307`).
2. Em cada subpasta, coloque:
   - `email.pdf`
   - `docbasico.pdf`

### 5. Executar a triagem

```
exec\executar.bat
```

---

## Passo a passo — atualizar versão do código

Use quando houver nova versão no GitHub e você quiser atualizar **sem perder** configuração nem PDFs.

1. Feche o robô se estiver rodando.
2. Execute:
   ```
   exec\atualizar-robo.bat
   ```
3. Confirme a pasta de destino (padrão: `C:\Users\nayarapb\Documents\Teste_Robo_EAA_DVS`).
4. Aguarde a conclusão.

**O que é preservado automaticamente:**

| Item | Preservado? |
|------|-------------|
| `config\config.json` | Sim |
| `data\documentos\` (PDFs) | Sim |
| `node-v25.9.0-win-x64\` | Sim (não é sobrescrito) |

5. Se o README ou `package.json` indicarem mudança de dependências, rode novamente:
   ```
   exec\configurar-projeto-inicial.bat
   ```
6. Execute a triagem:
   ```
   exec\executar.bat
   ```

---

## Atalho na raiz do projeto

Também é possível usar:

```
atualizar-robo.bat
```

( redireciona para `exec\atualizar-robo.bat` )

---

## Solução de problemas

| Problema | Ação |
|----------|------|
| Falha no download | Verifique internet; tente novamente |
| Pasta de destino incorreta | Rode de novo e digite o caminho correto |
| `config.json` sumiu | Restaure de backup ou copie de `config\config.sample.json` |
| Erro ao executar | Rode `exec\configurar-projeto-inicial.bat` |

---

## URL do pacote

```
https://github.com/naypopro-code/robo-alvara/archive/refs/heads/main.zip
```
