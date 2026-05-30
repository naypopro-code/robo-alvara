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

Guia completo para PO: [`docs/GUIA-ATUALIZACAO-PO.md`](docs/GUIA-ATUALIZACAO-PO.md)

Depois, edite `config\config.json` (organizado por grupos; campos na raiz ainda funcionam por compatibilidade):

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

## Scripts `.bat` e exemplos de uso

### 1) Setup do projeto

- **Arquivo:** `exec\configurar-projeto-inicial.bat`
- **O que faz:** prepara Node bundled, dependências e config inicial.

```cmd
exec\configurar-projeto-inicial.bat
```

### 2) Atualizar código (download GitHub ZIP)

- **Arquivo principal:** `exec\atualizar-robo.bat`
- **Atalho:** `atualizar-robo.bat` (na raiz)
- **O que faz:** baixa `main.zip` do GitHub, extrai e copia para a pasta de destino (padrão: `C:\Users\nayarapb\Documents\Teste_Robo_EAA_DVS`), preservando `config.json` e `data\documentos\`.

```cmd
exec\atualizar-robo.bat
```

ou:

```cmd
atualizar-robo.bat
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
