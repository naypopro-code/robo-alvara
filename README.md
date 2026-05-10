# Robô Alvará — Triagem BDD EAA-DVS

Robô que percorre subpastas com PDFs (`email.pdf` + `docbasico.pdf`), pede ao Gemini para extrair os campos relevantes e envia o resultado para uma planilha do Google Sheets via Apps Script.

## Estrutura

```
robo-alvara/
├── config/
│   ├── config.json          ← valores reais (gitignored)
│   ├── config.sample.json   ← template commitado
│   └── prompt.txt           ← prompt enviado ao Gemini
├── data/                    ← entradas (PDFs) e saídas (logs, runs) — gitignored
│   └── .gitkeep
├── src/
│   ├── main.js              ← script principal de triagem
│   ├── lista.js             ← lista os modelos disponíveis para a chave Gemini
│   └── testePlanilha.js     ← testa conexão com a planilha (Apps Script)
├── node-v25.9.0-win-x64/    ← runtime Node bundled (Windows, gitignored)
├── scripts/
│   └── setup.js             ← chamado por `npm run setup` e pelo .bat de setup
├── configurar-projeto-inicial.bat  ← bootstrap Windows (baixa Node + npm install + setup)
├── executar.bat             ← roda src/main.js
├── lista.bat                ← roda src/lista.js
├── teste-planilha.bat       ← roda src/testePlanilha.js
├── package.json
├── .gitignore
└── README.md
```

## Setup

### Setup automatico (Windows, recomendado)

Clique duas vezes em **`configurar-projeto-inicial.bat`**. Ele faz tudo:

1. Baixa o Node.js bundled (`node-v25.9.0-win-x64`) de `nodejs.org` e extrai na raiz.
2. Roda `npm install`.
3. Cria `config/config.json` a partir do `config.sample.json` (se ainda não existir).
4. Garante a pasta `data/`.

Depois, edite `config/config.json` com os valores reais e rode `executar.bat`.

### Setup manual (Node já instalado)

```cmd
npm install
npm run setup       :: cria config/config.json e data/
```

Edite `config/config.json`:

| Campo | Descrição |
|---|---|
| `CHAVE_GEMINI` | API key do Google Gemini |
| `URL_PLANILHA` | URL do Web App do Apps Script que recebe os dados |
| `PASTA_RAIZ` | Pasta com as subpastas numeradas que contêm os PDFs (caminho absoluto ou relativo à raiz do projeto) |
| `CAMINHO_PROMPT` | Caminho do prompt (default: `config/prompt.txt`) |
| `CAMINHO_LOG` | Log narrativo de processamento (default: `data/log_processamento.txt`) |
| `CAMINHO_ERRO_LOG` | Log estruturado de falhas em JSON Lines (default: `data/error.log`) |

`config/config.json` está no `.gitignore` e nunca deve ser commitado.

> Em Windows com o Node bundled, os `.bat` apontam para o `node.exe` local — não precisa instalar Node globalmente.

## Como rodar

### Via npm scripts

```bash
npm start                    # = npm run triagem  → src/main.js
npm run lista                # → src/lista.js (lista modelos Gemini disponíveis)
npm run teste:planilha       # → src/testePlanilha.js (testa POST na planilha)
npm run setup                # cria config/config.json + data/ (idempotente)
```

> `setup` também roda automaticamente após `npm install` (via `postinstall`).

### Via executores (Windows)

Clique duplo no Explorer ou via terminal:

```cmd
executar.bat
lista.bat
teste-planilha.bat
```

> O projeto suporta apenas Windows. As demais SOs podem rodar via `npm` scripts, desde que o Node esteja instalado e os caminhos em `config.json` apontem para pastas válidas.

## Como funciona o `main.js`

1. Lê `config/config.json`.
2. Para cada subpasta numerada dentro de `PASTA_RAIZ`:
   - Verifica se contém `email.pdf` e `docbasico.pdf` (se faltar algum, registra em `error.log` e pula).
   - Envia os dois PDFs + o prompt (`config/prompt.txt`) para o Gemini.
   - Faz parse da resposta (formato pipe-separated).
   - Faz `POST` do resultado para `URL_PLANILHA`.
3. Aguarda 2s entre pastas (rate limiting).
4. No final, imprime `Sucesso: N | Falhas: N`.

## Logs

- **`data/log_processamento.txt`** — log narrativo, uma linha por evento, em pt-BR. Bom para acompanhar uma execução.
- **`data/error.log`** — JSON Lines (uma falha por linha) com `timestamp`, `numPasta`, `stage`, `message` e contexto extra. Ideal para reprocessar pastas que falharam.

  Stages possíveis: `startup`, `missing_files`, `gemini_call`, `parse_response`, `planilha_post`, `planilha_http`.

  Exemplo:
  ```bash
  # Pastas que falharam por falta de arquivos
  jq -r 'select(.stage=="missing_files") | .numPasta' data/error.log
  ```

## Notas de segurança

- `src/lista.js` ainda tem a chave Gemini **hardcoded** (igual à de `config.json`). É um utilitário de diagnóstico; em produção, prefira `npm run teste:planilha` / `npm start`.
- `src/testePlanilha.js` tem uma URL de Apps Script **diferente** (endpoint de teste); não compartilha a `URL_PLANILHA` da config.
- Nunca commite `config/config.json`, `Chave_Robo_DVS.txt` ou qualquer conteúdo de `data/`.
