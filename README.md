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
├── data/                    ← entradas (PDFs) e saídas (logs, runs) — gitignored
├── exec/
│   ├── configurar-projeto-inicial.bat  ← bootstrap (baixa Node + npm install + setup)
│   ├── executar.bat         ← roda src/main.js
│   ├── lista.bat            ← roda src/lista.js
│   └── teste-planilha.bat   ← roda src/testePlanilha.js
├── src/
│   ├── main.js              ← script principal de triagem
│   ├── lista.js             ← lista os modelos disponíveis para a chave Gemini
│   └── testePlanilha.js     ← testa conexão com a planilha (Apps Script)
├── node-v25.9.0-win-x64/    ← runtime Node bundled (gitignored, baixado pelo bootstrap)
├── package.json
├── .gitignore
└── README.md
```

## Setup

Clique duas vezes em **`exec\configurar-projeto-inicial.bat`**. Ele faz tudo:

1. Baixa o Node.js bundled (`node-v25.9.0-win-x64`) de `nodejs.org` e extrai na raiz do projeto.
2. Roda `npm install` usando o npm bundled.
3. Cria a pasta `data\`.
4. Cria `config\config.json` a partir do `config.sample.json` (se ainda não existir).

Depois, edite `config\config.json`:

| Campo | Default | Descrição |
|---|---|---|
| `CHAVE_GEMINI` | — | API key do Google Gemini |
| `URL_PLANILHA` | — | URL do Web App do Apps Script que recebe os dados |
| `PASTA_RAIZ` | — | Pasta com as subpastas numeradas que contêm os PDFs (absoluta ou relativa à raiz do projeto) |
| `CAMINHO_PROMPT` | `config/prompt.txt` | Caminho do prompt |
| `CAMINHO_LOG` | `data/log_processamento.txt` | Log narrativo |
| `CAMINHO_ERRO_LOG` | `data/error.log` | Log estruturado de falhas (JSON Lines) |
| `MODELO_GEMINI` | `gemini-2.5-flash` | Nome do modelo Gemini (ex.: `gemini-2.5-flash`, `gemini-flash-lite-latest`) |
| `INTERVALO_PASTAS_MS` | `15000` | Pausa em ms entre cada pasta (rate-limit) |
| `RETRY_TENTATIVAS` | `3` | Número de retries após a 1ª falha (0 desliga retry) |
| `RETRY_INTERVALO_MS` | `5000` | Pausa em ms antes de cada rodada de retry |

`config\config.json` está no `.gitignore` e nunca deve ser commitado.

## Como rodar

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
2. **1ª passada:** para cada subpasta numerada dentro de `PASTA_RAIZ`:
   - Verifica se contém `email.pdf` e `docbasico.pdf`.
   - Envia os dois PDFs + o prompt (`config\prompt.txt`) para o Gemini (`MODELO_GEMINI`).
   - Faz parse da resposta (formato pipe-separated).
   - Faz `POST` do resultado para `URL_PLANILHA`.
   - Aguarda `INTERVALO_PASTAS_MS` entre pastas.
   - Em caso de falha (qualquer stage), a pasta é colocada em uma **fila de retry em memória** e a falha vira um WARN no log narrativo — *nada* vai para `error.log` ainda.
3. **Rodadas de retry:** após a 1ª passada, se a fila não estiver vazia, roda até `RETRY_TENTATIVAS` rodadas. Antes de cada rodada aguarda `RETRY_INTERVALO_MS`. Pastas que dão sucesso saem da fila; pastas que continuam falhando permanecem.
4. **Falhas definitivas:** o que sobra na fila depois de todas as rodadas vai para `error.log`, com o campo `tentativas` indicando quantas tentativas foram feitas.
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
  Stages possíveis: `startup`, `missing_files`, `gemini_call`, `parse_response`, `planilha_post`, `planilha_http`, `unknown`.

## Notas de segurança

- `src\main.js`, `src\lista.js` e `src\testePlanilha.js` leem `CHAVE_GEMINI` e `URL_PLANILHA` de `config\config.json`. Nenhum segredo fica em código commitado.
- Nunca commite `config\config.json` ou qualquer conteúdo de `data\`.
