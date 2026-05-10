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

// Resolve caminhos relativos contra a raiz do projeto (não contra src/).
const resolverCaminho = (p) => path.isAbsolute(p) ? p : path.join(PROJECT_ROOT, p);

const CHAVE_GEMINI = cfg.CHAVE_GEMINI;
const URL_PLANILHA = cfg.URL_PLANILHA;
const PASTA_RAIZ = resolverCaminho(cfg.PASTA_RAIZ);
const CAMINHO_PROMPT = resolverCaminho(cfg.CAMINHO_PROMPT);
const CAMINHO_LOG = resolverCaminho(cfg.CAMINHO_LOG);
const CAMINHO_ERRO_LOG = resolverCaminho(cfg.CAMINHO_ERRO_LOG);

// --- 2. INICIALIZAÇÃO ---
const genAI = new GoogleGenerativeAI(CHAVE_GEMINI);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Função auxiliar para gravar logs
function gravarLog(mensagem) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const linhaLog = `[${timestamp}] ${mensagem}\n`;
    fs.appendFileSync(CAMINHO_LOG, linhaLog);
}

// Grava falhas em error.log (JSON Lines) para permitir reprocessamento.
function gravarErro({ numPasta, stage, message, extra }) {
    const entry = {
        timestamp: new Date().toISOString(),
        numPasta: numPasta || null,
        stage,
        message,
        ...(extra || {}),
    };
    fs.appendFileSync(CAMINHO_ERRO_LOG, JSON.stringify(entry) + '\n');
}

async function processarTriagem() {
    const inicioMsg = "🚀 [SISTEMA] Iniciando Triagem BDD EAA-DVS...";
    console.log(inicioMsg);
    gravarLog(inicioMsg);

    if (!fs.existsSync(PASTA_RAIZ) || !fs.existsSync(CAMINHO_PROMPT)) {
        const erroMsg = "❌ [ERRO] Pasta raiz ou prompt.txt não encontrados.";
        console.log(erroMsg);
        gravarLog(erroMsg);
        gravarErro({
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
    let contadorFalha = 0;

    for (const numPasta of pastas) {
        const caminhoPasta = path.join(PASTA_RAIZ, numPasta);
        const arquivos = fs.readdirSync(caminhoPasta);

        console.log(`\n--- 🔎 AUDITORIA BDD: Pasta ${numPasta} ---`);
        gravarLog(`Iniciando análise da Pasta: ${numPasta}`);

        try {
            // --- FILTRAGEM ESPECÍFICA DE ARQUIVOS ---
            const nomeArquivoEmail = "email.pdf";
            const nomeArquivoDocBasico = "docbasico.pdf";

            const temEmail = arquivos.some(f => f.toLowerCase() === nomeArquivoEmail);
            const temDocBasico = arquivos.some(f => f.toLowerCase() === nomeArquivoDocBasico);

            if (!temEmail || !temDocBasico) {
                const faltantes = [];
                if (!temEmail) faltantes.push(nomeArquivoEmail);
                if (!temDocBasico) faltantes.push(nomeArquivoDocBasico);

                const aviso = `⚠️ [AVISO] Pasta ${numPasta} ignorada. Faltam: ${faltantes.join(' e ')}`;
                console.log(aviso);
                gravarLog(aviso);
                gravarErro({
                    numPasta,
                    stage: 'missing_files',
                    message: `Arquivos obrigatórios ausentes: ${faltantes.join(', ')}`,
                    extra: { arquivosFaltantes: faltantes },
                });
                contadorFalha++;
                continue;
            }

            // Lê apenas os dois arquivos solicitados
            const pdfsParaEnviar = [nomeArquivoEmail, nomeArquivoDocBasico].map(nome => {
                const caminhoCompleto = path.join(caminhoPasta, nome);
                return {
                    inlineData: {
                        mimeType: "application/pdf",
                        data: fs.readFileSync(caminhoCompleto).toString('base64')
                    }
                };
            });

            const promptFinal = promptTemplate.replace('{{numPasta}}', numPasta);

            console.log(`🧠 [IA] Analisando ${nomeArquivoEmail} e ${nomeArquivoDocBasico}...`);

            let result;
            try {
                result = await model.generateContent([...pdfsParaEnviar, { text: promptFinal }]);
            } catch (errGemini) {
                gravarErro({
                    numPasta,
                    stage: 'gemini_call',
                    message: errGemini.message,
                });
                throw errGemini;
            }

            let respostaTexto = result.response.text().trim();
            console.log(`📝 [IA RESPOSTA]:\n${respostaTexto}`);

            const linhas = respostaTexto.split('\n').filter(l => l.includes('|'));
            if (linhas.length === 0) {
                gravarErro({
                    numPasta,
                    stage: 'parse_response',
                    message: 'IA retornou resposta em formato inválido.',
                    extra: { respostaTexto },
                });
                throw new Error("IA retornou resposta em formato inválido.");
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
                motivo: partes[9] || "Não especificado pela IA"
            };

            gravarLog(`Resultado Pasta ${numPasta}: Status=${dadosParaPlanilha.status} | Confiança=${dadosParaPlanilha.confianca}% | Motivo=${dadosParaPlanilha.motivo}`);

            let responsePlanilha;
            try {
                responsePlanilha = await fetch(URL_PLANILHA, {
                    method: 'POST',
                    body: JSON.stringify(dadosParaPlanilha)
                });
            } catch (errFetch) {
                gravarErro({
                    numPasta,
                    stage: 'planilha_post',
                    message: errFetch.message,
                    extra: { dados: dadosParaPlanilha },
                });
                throw errFetch;
            }

            if (responsePlanilha.ok) {
                console.log(`✅ [SUCESSO] Status: ${dadosParaPlanilha.status}`);
                contadorSucesso++;
            } else {
                const httpMsg = `Erro Planilha Pasta ${numPasta}: Status HTTP ${responsePlanilha.status}`;
                gravarLog(httpMsg);
                gravarErro({
                    numPasta,
                    stage: 'planilha_http',
                    message: httpMsg,
                    extra: { httpStatus: responsePlanilha.status, dados: dadosParaPlanilha },
                });
                contadorFalha++;
            }

            await new Promise(r => setTimeout(r, 2000));

        } catch (err) {
            const erroMsg = `❌ [ERRO] Pasta ${numPasta}: ${err.message}`;
            console.error(erroMsg);
            gravarLog(erroMsg);
            // Se ainda não foi registrado por um stage específico, registra como unknown.
            // (Os blocos internos já gravam antes de re-lançar; este é o catch-all.)
            contadorFalha++;
        }
    }

    const fimMsg = `🏁 Triagem concluída. Sucesso: ${contadorSucesso} | Falhas: ${contadorFalha}`;
    console.log(fimMsg);
    gravarLog(fimMsg + "\n" + "=".repeat(50));
    if (contadorFalha > 0) {
        console.log(`📄 Detalhes das falhas em: ${CAMINHO_ERRO_LOG}`);
    }
}

processarTriagem();
