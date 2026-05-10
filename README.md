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

| Campo | Descrição |
|---|---|
| `CHAVE_GEMINI` | API key do Google Gemini |
| `URL_PLANILHA` | URL do Web App do Apps Script que recebe os dados |
| `PASTA_RAIZ` | Pasta com as subpastas numeradas que contêm os PDFs (caminho absoluto ou relativo à raiz do projeto) |
| `CAMINHO_PROMPT` | Caminho do prompt (default: `config/prompt.txt`) |
| `CAMINHO_LOG` | Log narrativo (default: `data/log_processamento.txt`) |
| `CAMINHO_ERRO_LOG` | Log estruturado de falhas em JSON Lines (default: `data/error.log`) |

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
2. Para cada subpasta numerada dentro de `PASTA_RAIZ`:
   - Verifica se contém `email.pdf` e `docbasico.pdf` (se faltar algum, registra em `error.log` e pula).
   - Envia os dois PDFs + o prompt (`config\prompt.txt`) para o Gemini.
   - Faz parse da resposta (formato pipe-separated).
   - Faz `POST` do resultado para `URL_PLANILHA`.
3. Aguarda 2s entre pastas (rate limiting).
4. No final, imprime `Sucesso: N | Falhas: N`.

## Logs

- **`data\log_processamento.txt`** — log narrativo, uma linha por evento, em pt-BR. Bom para acompanhar uma execução.
- **`data\error.log`** — JSON Lines (uma falha por linha) com `timestamp`, `numPasta`, `stage`, `message` e contexto extra. Ideal para reprocessar pastas que falharam.

  Stages possíveis: `startup`, `missing_files`, `gemini_call`, `parse_response`, `planilha_post`, `planilha_http`.

## Notas de segurança

- Tanto `src\main.js` quanto `src\lista.js` leem a `CHAVE_GEMINI` de `config\config.json`. Nenhum segredo fica em código commitado.
- `src\testePlanilha.js` tem uma URL de Apps Script **diferente** (endpoint de teste); não compartilha a `URL_PLANILHA` da config.
- Nunca commite `config\config.json`, `Chave_Robo_DVS.txt` ou qualquer conteúdo de `data\`.
