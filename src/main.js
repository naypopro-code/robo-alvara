const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// --- 1. CONFIGURAÇÕES ---
const PROJECT_ROOT = path.join(__dirname, '..');
const CAMINHO_CONFIG = path.join(PROJECT_ROOT, 'config', 'config.json');

let cfgRaw;
try {
    cfgRaw = fs.readFileSync(CAMINHO_CONFIG, 'utf8');
} catch (e) {
    console.error(`❌ [ERRO] Arquivo de config não encontrado: ${CAMINHO_CONFIG}`);
    console.error("    Copie config/config.sample.json para config/config.json e preencha os valores.");
    process.exit(1);
}

let cfg;
try {
    cfg = JSON.parse(cfgRaw);
} catch (e) {
    console.error(`❌ [ERRO] config.json com JSON inválido: ${e.message}`);
    process.exit(1);
}

const resolverCaminho = (p) => path.isAbsolute(p) ? p : path.join(PROJECT_ROOT, p);

const CHAVE_GEMINI = cfg.CHAVE_GEMINI;
const URL_PLANILHA = cfg.URL_PLANILHA;
const PASTA_RAIZ = resolverCaminho(cfg.PASTA_RAIZ);
const CAMINHO_PROMPT = resolverCaminho(cfg.CAMINHO_PROMPT);
const CAMINHO_LOG = resolverCaminho(cfg.CAMINHO_LOG);
const CAMINHO_ERRO_LOG = resolverCaminho(cfg.CAMINHO_ERRO_LOG);

const MODELO_GEMINI = cfg.MODELO_GEMINI || "gemini-2.5-flash";
const INTERVALO_PASTAS_MS = Number.isFinite(cfg.INTERVALO_PASTAS_MS) ? cfg.INTERVALO_PASTAS_MS : 15000;
const RETRY_TENTATIVAS = Number.isFinite(cfg.RETRY_TENTATIVAS) ? cfg.RETRY_TENTATIVAS : 3;
const RETRY_INTERVALO_MS = Number.isFinite(cfg.RETRY_INTERVALO_MS) ? cfg.RETRY_INTERVALO_MS : 5000;

// --- 2. INICIALIZAÇÃO ---
const genAI = new GoogleGenerativeAI(CHAVE_GEMINI);
const model = genAI.getGenerativeModel({ model: MODELO_GEMINI });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function gravarLog(mensagem) {
    const timestamp = new Date().toLocaleString('pt-BR');
    fs.appendFileSync(CAMINHO_LOG, `[${timestamp}] ${mensagem}\n`);
}

// Reporta na planilha que uma pasta esgotou todas as tentativas.
// status="ERRO", motivo=mensagem do ultimo erro. Demais campos vazios ("---").
// Tolerante a falha: se o POST falhar, só registra warn no log narrativo
// (a falha original já está em error.log, não queremos cascatear).
async function postarErroPlanilha(numPasta, erro) {
    const dadosErro = {
        numPasta,
        dataEmail: "---",
        email: "---",
        cnpj: "---",
        razao: "---",
        endereco: "---",
        docCompleta: "---",
        atividade: "---",
        status: "ERRO",
        confianca: "0",
        motivo: (erro && erro.message) || "Erro desconhecido",
    };

    try {
        const resp = await fetch(URL_PLANILHA, {
            method: 'POST',
            body: JSON.stringify(dadosErro),
        });
        if (resp.ok) {
            gravarLog(`📤 [PLANILHA-ERRO] Pasta ${numPasta} reportada como ERRO na planilha.`);
        } else {
            gravarLog(`⚠️ [PLANILHA-ERRO] Falha HTTP ${resp.status} ao reportar pasta ${numPasta}.`);
        }
    } catch (err) {
        gravarLog(`⚠️ [PLANILHA-ERRO] Falha ao reportar pasta ${numPasta}: ${err.message}`);
    }
}

// Move log_processamento.txt e error.log da execução anterior para
// data/archive/<base>_<timestamp>.<ext>. Roda como PRIMEIRA coisa, antes
// de qualquer gravarLog/gravarErroFinal — caso contrário os logs novos
// se misturariam aos antigos.
function arquivarLogsAnteriores() {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const alvos = [CAMINHO_LOG, CAMINHO_ERRO_LOG];

    for (const src of alvos) {
        if (!fs.existsSync(src)) continue;
        try {
            if (fs.statSync(src).size === 0) continue;
        } catch (_) {
            continue;
        }
        const archiveDir = path.join(path.dirname(src), 'archive');
        try {
            fs.mkdirSync(archiveDir, { recursive: true });
            const ext = path.extname(src);
            const base = path.basename(src, ext);
            const dst = path.join(archiveDir, `${base}_${ts}${ext}`);
            fs.renameSync(src, dst);
            console.log(`📦 [ARCHIVE] ${path.basename(src)} -> archive/${path.basename(dst)}`);
        } catch (err) {
            // Não interrompe a execução se o archive falhar — apenas avisa.
            console.warn(`⚠️ [ARCHIVE] Falha ao arquivar ${src}: ${err.message}`);
        }
    }
}

// Gravado apenas APÓS esgotar todas as tentativas de retry. Tudo aqui é falha definitiva.
function gravarErroFinal({ numPasta, stage, message, extra, tentativas }) {
    const entry = {
        timestamp: new Date().toISOString(),
        numPasta: numPasta || null,
        stage,
        message,
        tentativas: tentativas || 1,
        ...(extra || {}),
    };
    fs.appendFileSync(CAMINHO_ERRO_LOG, JSON.stringify(entry) + '\n');
}

// Processa uma pasta completa. Retorna:
//   { sucesso: true, status }                              em caso de sucesso
//   { sucesso: false, erro: { numPasta, stage, message, extra } } em caso de falha
async function processarPasta(numPasta, caminhoPasta, promptTemplate) {
    const nomeArquivoEmail = "email.pdf";
    const nomeArquivoDocBasico = "docbasico.pdf";

    let arquivos;
    try {
        arquivos = fs.readdirSync(caminhoPasta);
    } catch (e) {
        return { sucesso: false, erro: { numPasta, stage: 'unknown', message: `Falha ao ler pasta: ${e.message}` } };
    }

    const temEmail = arquivos.some(f => f.toLowerCase() === nomeArquivoEmail);
    const temDocBasico = arquivos.some(f => f.toLowerCase() === nomeArquivoDocBasico);

    if (!temEmail || !temDocBasico) {
        const faltantes = [];
        if (!temEmail) faltantes.push(nomeArquivoEmail);
        if (!temDocBasico) faltantes.push(nomeArquivoDocBasico);
        return {
            sucesso: false,
            erro: {
                numPasta,
                stage: 'missing_files',
                message: `Arquivos obrigatórios ausentes: ${faltantes.join(', ')}`,
                extra: { arquivosFaltantes: faltantes },
            },
        };
    }

    const pdfsParaEnviar = [nomeArquivoEmail, nomeArquivoDocBasico].map(nome => {
        const caminhoCompleto = path.join(caminhoPasta, nome);
        return {
            inlineData: {
                mimeType: "application/pdf",
                data: fs.readFileSync(caminhoCompleto).toString('base64'),
            },
        };
    });

    const promptFinal = promptTemplate.replace('{{numPasta}}', numPasta);

    console.log(`🧠 [IA] Analisando ${nomeArquivoEmail} e ${nomeArquivoDocBasico}...`);

    let result;
    try {
        result = await model.generateContent([...pdfsParaEnviar, { text: promptFinal }]);
    } catch (err) {
        return { sucesso: false, erro: { numPasta, stage: 'gemini_call', message: err.message } };
    }

    let respostaTexto;
    try {
        respostaTexto = result.response.text().trim();
    } catch (err) {
        return { sucesso: false, erro: { numPasta, stage: 'parse_response', message: `Falha ao ler resposta da IA: ${err.message}` } };
    }
    console.log(`📝 [IA RESPOSTA]:\n${respostaTexto}`);

    const linhas = respostaTexto.split('\n').filter(l => l.includes('|'));
    if (linhas.length === 0) {
        return {
            sucesso: false,
            erro: {
                numPasta,
                stage: 'parse_response',
                message: 'IA retornou resposta em formato inválido.',
                extra: { respostaTexto },
            },
        };
    }

    const partes = linhas[linhas.length - 1].split('|').map(t => t.trim());
    const dadosParaPlanilha = {
        numPasta: numPasta,
        dataEmail: partes[0] || "---",
        email: partes[1] || "---",
        cnpj: partes[2] || "---",
        razao: partes[3] || "---",
        endereco: partes[4] || "---",
        docCompleta: partes[5] || "---",
        atividade: partes[6] || "---",
        status: partes[7] || "Verificar",
        confianca: partes[8] || "0",
        motivo: partes[9] || "Não especificado pela IA",
    };

    gravarLog(`Resultado Pasta ${numPasta}: Status=${dadosParaPlanilha.status} | Confiança=${dadosParaPlanilha.confianca}% | Motivo=${dadosParaPlanilha.motivo}`);

    let responsePlanilha;
    try {
        responsePlanilha = await fetch(URL_PLANILHA, {
            method: 'POST',
            body: JSON.stringify(dadosParaPlanilha),
        });
    } catch (err) {
        return {
            sucesso: false,
            erro: { numPasta, stage: 'planilha_post', message: err.message, extra: { dados: dadosParaPlanilha } },
        };
    }

    if (!responsePlanilha.ok) {
        return {
            sucesso: false,
            erro: {
                numPasta,
                stage: 'planilha_http',
                message: `Status HTTP ${responsePlanilha.status}`,
                extra: { httpStatus: responsePlanilha.status, dados: dadosParaPlanilha },
            },
        };
    }

    return { sucesso: true, status: dadosParaPlanilha.status };
}

async function processarTriagem() {
    arquivarLogsAnteriores();

    const inicioMsg = `🚀 [SISTEMA] Iniciando Triagem BDD EAA-DVS (modelo=${MODELO_GEMINI}, intervalo=${INTERVALO_PASTAS_MS}ms, retry=${RETRY_TENTATIVAS}x@${RETRY_INTERVALO_MS}ms)`;
    console.log(inicioMsg);
    gravarLog(inicioMsg);

    if (!fs.existsSync(PASTA_RAIZ) || !fs.existsSync(CAMINHO_PROMPT)) {
        const erroMsg = "❌ [ERRO] Pasta raiz ou prompt.txt não encontrados.";
        console.log(erroMsg);
        gravarLog(erroMsg);
        gravarErroFinal({
            stage: 'startup',
            message: erroMsg,
            extra: {
                pastaRaizExiste: fs.existsSync(PASTA_RAIZ),
                promptExiste: fs.existsSync(CAMINHO_PROMPT),
            },
        });
        return;
    }

    const pastas = fs.readdirSync(PASTA_RAIZ).filter(f => fs.lstatSync(path.join(PASTA_RAIZ, f)).isDirectory());
    const promptTemplate = fs.readFileSync(CAMINHO_PROMPT, 'utf8');

    let contadorSucesso = 0;
    const filaRetry = []; // { numPasta, caminhoPasta, tentativaAtual, ultimoErro }

    // --- 1ª PASSADA ---
    for (const numPasta of pastas) {
        const caminhoPasta = path.join(PASTA_RAIZ, numPasta);

        console.log(`\n--- 🔎 AUDITORIA BDD: Pasta ${numPasta} ---`);
        gravarLog(`Iniciando análise da Pasta: ${numPasta}`);

        const resultado = await processarPasta(numPasta, caminhoPasta, promptTemplate);
        if (resultado.sucesso) {
            console.log(`✅ [SUCESSO] Status: ${resultado.status}`);
            contadorSucesso++;
        } else {
            const aviso = `⚠️ [WARN] Pasta ${numPasta} falhou (${resultado.erro.stage}): ${resultado.erro.message}. Será retentada.`;
            console.log(aviso);
            gravarLog(aviso);
            filaRetry.push({
                numPasta,
                caminhoPasta,
                tentativaAtual: 1,
                ultimoErro: resultado.erro,
            });
        }

        await sleep(INTERVALO_PASTAS_MS);
    }

    // --- RETRIES ---
    let rodada = 0;
    while (filaRetry.length > 0 && rodada < RETRY_TENTATIVAS) {
        rodada++;
        const aviso = `\n🔁 [RETRY ${rodada}/${RETRY_TENTATIVAS}] Reprocessando ${filaRetry.length} pasta(s) pendente(s)...`;
        console.log(aviso);
        gravarLog(aviso);

        await sleep(RETRY_INTERVALO_MS);

        const aindaFalhando = [];
        for (const item of filaRetry) {
            console.log(`\n--- 🔁 RETRY ${rodada}: Pasta ${item.numPasta} ---`);
            gravarLog(`Retry ${rodada} da Pasta: ${item.numPasta}`);

            const resultado = await processarPasta(item.numPasta, item.caminhoPasta, promptTemplate);
            if (resultado.sucesso) {
                const ok = `✅ [RETRY ${rodada}] Pasta ${item.numPasta} OK. Status: ${resultado.status}`;
                console.log(ok);
                gravarLog(ok);
                contadorSucesso++;
            } else {
                item.tentativaAtual = rodada + 1;
                item.ultimoErro = resultado.erro;
                const aviso = `⚠️ [WARN RETRY ${rodada}] Pasta ${item.numPasta} ainda falhou (${resultado.erro.stage}): ${resultado.erro.message}.`;
                console.log(aviso);
                gravarLog(aviso);
                aindaFalhando.push(item);
            }

            await sleep(INTERVALO_PASTAS_MS);
        }

        filaRetry.length = 0;
        filaRetry.push(...aindaFalhando);
    }

    // --- FALHAS DEFINITIVAS → error.log + planilha ---
    for (const item of filaRetry) {
        gravarErroFinal({ ...item.ultimoErro, tentativas: item.tentativaAtual });
        gravarLog(`❌ [FALHA DEFINITIVA] Pasta ${item.numPasta} apos ${item.tentativaAtual} tentativas: ${item.ultimoErro.message}`);
        await postarErroPlanilha(item.numPasta, item.ultimoErro);
    }
    const contadorFalha = filaRetry.length;

    const fimMsg = `🏁 Triagem concluída. Sucesso: ${contadorSucesso} | Falhas definitivas: ${contadorFalha}`;
    console.log(fimMsg);
    gravarLog(fimMsg + "\n" + "=".repeat(50));
    if (contadorFalha > 0) {
        console.log(`📄 Detalhes das falhas em: ${CAMINHO_ERRO_LOG}`);
    }
}

processarTriagem();
