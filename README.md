# Robô Alvará — Triagem BDD EAA-DVS

> **Plataforma:** Windows. O projeto suporta apenas Windows.

Robô que percorre subpastas com PDFs (`email.pdf` + `docbasico.pdf`), pede ao Gemini para extrair os campos relevantes e envia o resultado para uma planilha do Google Sheets via Apps Script.

## Estrutura

```
robo-alvara/
├── config/
│   ├── config.json          ← valores reais (gitignored)
│   ├── config.sample.json   ← template commitado
│   └── prompt.txt           ← prompt enviado ao Gemini
├── data/
│   └── documentos/          ← subpastas numeradas com PDFs (256/, etc.) — gitignored
├── exec/
│   ├── configurar-projeto-inicial.bat  ← bootstrap (Node + npm install + setup)
│   ├── atualizar-robo.bat   ← baixa ZIP do GitHub e atualiza o projeto
│   ├── executar.bat         ← roda src/main.js
│   ├── lista.bat            ← roda src/lista.js
│   └── teste-planilha.bat   ← roda src/testePlanilha.js
├── src/
│   ├── main.js              ← script principal de triagem
│   ├── lista.js             ← lista os modelos disponíveis para a chave Gemini
│   └── testePlanilha.js     ← testa conexão com a planilha (Apps Script)
├── node-v25.9.0-win-x64/    ← runtime Node bundled (gitignored, baixado pelo bootstrap)
├── atualizar-robo.bat       ← atalho para exec\atualizar-robo.bat
├── package.json
├── .gitignore
└── README.md
```

## Setup Inicial

Clique duas vezes em **`exec\configurar-projeto-inicial.bat`**. Ele faz tudo:

1. Baixa o Node.js bundled (`node-v25.9.0-win-x64`) de `nodejs.org` e extrai na raiz do projeto.
2. Roda `npm install` usando o npm bundled.
3. Cria as pastas `data\` e `data\documentos\`.
4. Cria `config\config.json` a partir do `config.sample.json` (se ainda não existir).

Depois, edite `config\config.json`:

| Grupo | Campo | Default | Descrição |
|---|---|---|---|
| `integracao` | `chaveGemini` | — | API key do Google Gemini |
| `integracao` | `urlPlanilha` | — | URL do Web App do Apps Script que recebe os dados |
| `caminhos` | `pastaDocumentos` | `data/documentos` | Pasta com as subpastas numeradas (`256`, etc.) |
| `caminhos` | `prompt` | `config/prompt.txt` | Caminho do prompt |
| `caminhos` | `log` | `data/log_processamento.txt` | Log narrativo |
| `caminhos` | `erroLog` | `data/error.log` | Log estruturado de falhas (JSON Lines) |
| `gemini` | `modelo` | `gemini-2.5-flash` | Modelo Gemini |
| `triagem` | `intervaloPastasMs` | `15000` | Pausa em ms entre cada pasta |
| `triagem` | `retryTentativas` | `3` | Retries após a 1ª falha (0 desliga retry) |
| `triagem` | `retryIntervaloMs` | `5000` | Pausa em ms antes de cada rodada de retry |
| `planilha` | `postar` | `true` | `false` = dry-run (só loga JSON, sem POST) |
| `documentos` | `validarTamanho` | `true` | `false` = desliga validação de tamanho dos PDFs |
| `documentos` | `tamanhoMaxMb` | `50` | Tamanho máximo por PDF (`email.pdf` e `docbasico.pdf`) |

`config\config.json` está no `.gitignore` e nunca deve ser commitado.

## Como atualizar o projeto

Atualização **sem Git**: o script baixa o código direto do GitHub em ZIP.

**URL do pacote:**
```
https://github.com/naypopro-code/robo-alvara/archive/refs/heads/main.zip
```

**Pré-requisitos:** Windows, internet e permissão de escrita na pasta de instalação.

### Primeira instalação

1. Execute (duplo clique):
   ```cmd
   exec\atualizar-robo.bat
   ```
   (ou `atualizar-robo.bat` na raiz do projeto)

2. Confirme a pasta de destino. Padrão:
   ```
   C:\Users\nayarapb\Documents\Teste_Robo_EAA_DVS
   ```
   Pressione **Enter** para aceitar ou digite outro caminho. Confirme com **S**.

3. Aguarde as etapas `[1/5]` a `[5/5]`.

4. Rode o setup:
   ```cmd
   exec\configurar-projeto-inicial.bat
   ```

5. Edite `config\config.json`:
   - `integracao.chaveGemini`
   - `integracao.urlPlanilha`
   - `caminhos.pastaDocumentos` (ex.: `C:\...\01_documentos_alvara`)

6. Coloque os PDFs em subpastas numeradas dentro de `pastaDocumentos` (`252\`, `307\`, etc.), cada uma com `email.pdf` e `docbasico.pdf`.

7. Execute a triagem:
   ```cmd
   exec\executar.bat
   ```

### Atualizar versão do código

Use quando houver nova versão no GitHub, **sem perder** configuração nem PDFs.

1. Feche o robô se estiver rodando.
2. Execute:
   ```cmd
   exec\atualizar-robo.bat
   ```
3. Confirme a pasta de destino (padrão: `C:\Users\nayarapb\Documents\Teste_Robo_EAA_DVS`).
4. Aguarde a conclusão.

**Preservado automaticamente:**

| Item | Preservado? |
|------|-------------|
| `config\config.json` | Sim |
| `data\documentos\` (PDFs) | Sim |
| `node-v25.9.0-win-x64\` | Sim |

5. Se houver mudança de dependências, rode novamente:
   ```cmd
   exec\configurar-projeto-inicial.bat
   ```
6. Execute a triagem:
   ```cmd
   exec\executar.bat
   ```

### Solução de problemas (atualização)

| Problema | Ação |
|----------|------|
| **404 ao baixar** | Repositório privado ou ainda não publicado no GitHub (veja abaixo) |
| Falha no download | Verifique internet; tente novamente |
| Pasta de destino incorreta | Rode de novo e digite o caminho correto |
| `config.json` sumiu | Copie de `config\config.sample.json` e preencha |
| Erro ao executar | Rode `exec\configurar-projeto-inicial.bat` |

#### Erro 404 no download

O GitHub retorna **404** quando o repositório **não existe publicamente** ou é **privado**.

**Opção A — Tornar o repositório público**  
Publicar `naypopro-code/robo-alvara` no GitHub e rodar `exec\atualizar-robo.bat` de novo.

**Opção B — Repositório privado (token)**  
No CMD, antes de atualizar:
```cmd
set GITHUB_TOKEN=ghp_seu_token_aqui
exec\atualizar-robo.bat
```
Crie o token em GitHub → Settings → Developer settings → Personal access tokens (scope `repo`).

**Opção C — ZIP manual**  
Baixe o ZIP pelo GitHub (Code → Download ZIP) e rode:
```cmd
exec\atualizar-robo.bat "C:\Users\nayarapb\Documents\Teste_Robo_EAA_DVS" "C:\Downloads\robo-alvara-main.zip"
```

Opcional: copie `config\atualizacao.sample.json` para `config\atualizacao.json` e ajuste `github.owner`, `github.repo`, `github.branch` ou `zipUrl`.

## Scripts `.bat` e exemplos de uso

### 1) Setup do projeto

- **Arquivo:** `exec\configurar-projeto-inicial.bat`
- **O que faz:** prepara Node bundled, dependências e config inicial.

```cmd
exec\configurar-projeto-inicial.bat
```

### 2) Atualizar código (download GitHub ZIP)

Ver seção [Como atualizar o projeto](#como-atualizar-o-projeto).

```cmd
exec\atualizar-robo.bat
```

### 3) Rodar o robô e utilitários

- **Triagem principal (`src\main.js`):**

```cmd
exec\executar.bat
```

- **Listar modelos Gemini (`src\lista.js`):**

```cmd
exec\lista.bat
```

- **Testar POST da planilha (`src\testePlanilha.js`):**

```cmd
exec\teste-planilha.bat
```

## Como rodar (alternativa via npm)

### Via executores (recomendado)

Clique duplo no Explorer ou pelo terminal:

```cmd
exec\executar.bat
exec\lista.bat
exec\teste-planilha.bat
```

Cada `.bat` resolve a raiz do projeto via `%~dp0..` e usa o `node.exe` em `node-v25.9.0-win-x64\` — não depende de Node instalado globalmente.

### Via npm (se já tiver Node no PATH)

```cmd
npm start                  :: src\main.js
npm run lista              :: src\lista.js
npm run teste:planilha     :: src\testePlanilha.js
```

## Como funciona o `main.js`

1. Lê `config\config.json`.
2. **1ª passada:** para cada subpasta numerada dentro de `caminhos.pastaDocumentos` (ex.: `data/documentos/256`):
   - Verifica se contém `email.pdf` e `docbasico.pdf`.
   - Valida tamanho dos PDFs (se `documentos.validarTamanho` estiver ativo).
   - Registra o caminho completo da pasta no log.
   - Envia os dois PDFs + o prompt (`config\prompt.txt`) para o Gemini (`gemini.modelo`).
   - Faz parse da resposta (formato pipe-separated).
   - Faz `POST` do resultado para `integracao.urlPlanilha`.
   - Aguarda `triagem.intervaloPastasMs` entre pastas.
   - Em caso de falha:
     - `invalid_path` ou `file_too_large`: vai direto para fila de falha definitiva (**sem retry**).
     - demais stages: entram em fila de retry em memória.
3. **Rodadas de retry:** após a 1ª passada, se a fila não estiver vazia, roda até `triagem.retryTentativas` rodadas. Antes de cada rodada aguarda `triagem.retryIntervaloMs`. Pastas que dão sucesso saem da fila; pastas que continuam falhando permanecem.
4. **Falhas definitivas:** o que sobra na fila depois de todas as rodadas é tratado em duas frentes:
   - Vai para `error.log` com o campo `tentativas` indicando quantas tentativas foram feitas.
   - É **reportado na planilha** como uma linha com `status="ERRO"`, `motivo=<mensagem do último erro>` e os demais campos preenchidos com `"---"`. Assim a planilha sempre tem uma linha por pasta processada (sucesso ou falha definitiva). Se este POST de erro também falhar, é apenas registrado no log narrativo — não cascateia.
5. No final, imprime `Sucesso: N | Falhas definitivas: N`.

## Logs

- **`data\log_processamento.txt`** — log narrativo. Aqui ficam:
  - Eventos normais de cada pasta.
  - WARNs de falha na 1ª passada (`⚠️ [WARN] Pasta X falhou ... Será retentada.`).
  - WARNs de falha em cada rodada de retry.
  - Eventos de sucesso no retry (`✅ [RETRY n] Pasta X OK`).
  - Marca `❌ [FALHA DEFINITIVA]` para cada item que esgotou os retries.
- **`data\error.log`** — **somente** falhas definitivas (JSON Lines), uma por linha:
  ```json
  {"timestamp":"...","numPasta":"021","stage":"gemini_call","message":"503 ...","tentativas":4}
  ```
  Stages possíveis: `startup`, `invalid_path`, `file_too_large`, `read_dir`, `missing_files`, `gemini_call`, `parse_response`, `planilha_post`, `planilha_http`.

### Rotação automática (archive)

A cada execução de `main.js`, **antes** de qualquer log novo ser escrito, os arquivos
`log_processamento.txt` e `error.log` da execução anterior (se existirem e não estiverem vazios)
são movidos para `data\archive\` com timestamp UTC no nome:

```
data\archive\log_processamento_2026-05-10_17-09-34.txt
data\archive\error_2026-05-10_17-09-34.log
```

Cada execução começa com logs limpos. O histórico fica em `data\archive\`, que também está
no `.gitignore`. Não há limite de retenção — se quiser podar, apague manualmente.

## Notas de segurança

- `src\main.js`, `src\lista.js` e `src\testePlanilha.js` leem `integracao.chaveGemini` e `integracao.urlPlanilha` de `config\config.json`. Nenhum segredo fica em código commitado.
- Nunca commite `config\config.json` ou qualquer conteúdo de `data\`.
