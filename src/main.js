const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// =============================================================================
// Constantes
// =============================================================================

const PROJECT_ROOT = path.join(__dirname, '..');
const CAMINHO_CONFIG = path.join(PROJECT_ROOT, 'config', 'config.json');
const ARQUIVOS_PDF_OBRIGATORIOS = ['email.pdf', 'docbasico.pdf'];

// =============================================================================
// Configuração
// =============================================================================

function carregarConfigArquivo() {
    let cfgRaw;
    try {
        cfgRaw = fs.readFileSync(CAMINHO_CONFIG, 'utf8');
    } catch {
        console.error(`❌ [ERRO] Arquivo de config não encontrado: ${CAMINHO_CONFIG}`);
        console.error('    Copie config/config.sample.json para config/config.json e preencha os valores.');
        process.exit(1);
    }
    try {
        return JSON.parse(cfgRaw);
    } catch (e) {
        console.error(`❌ [ERRO] config.json com JSON inválido: ${e.message}`);
        process.exit(1);
    }
}

function obterCampo(cfg, grupo, campo, fallback) {
    const g = cfg[grupo];
    if (g && typeof g === 'object' && !Array.isArray(g) && g[campo] != null) {
        return g[campo];
    }
    if (cfg[campo] != null) {
        return cfg[campo];
    }
    return fallback;
}

function obterCampoObrigatorio(cfg, grupo, campo) {
    const valor = obterCampo(cfg, grupo, campo);
    if (valor == null || (typeof valor === 'string' && valor.trim() === '')) {
        console.error(`❌ [ERRO] Campo obrigatório ausente/inválido no config.json: ${grupo}.${campo}`);
        process.exit(1);
    }
    return valor;
}

function resolverCaminho(p) {
    return path.isAbsolute(p) ? p : path.join(PROJECT_ROOT, p);
}

function obterCaminho(cfg, grupo, campo) {
    return resolverCaminho(obterCampoObrigatorio(cfg, grupo, campo));
}

function obterBoolean(cfg, grupo, campo, fallback = false) {
    const valor = obterCampo(cfg, grupo, campo, fallback);
    if (valor === false || valor === 'false' || valor === 0) return false;
    if (valor === true || valor === 'true' || valor === 1) return true;
    return Boolean(valor);
}

function obterNumero(cfg, grupo, campo, fallback) {
    const n = Number(obterCampo(cfg, grupo, campo, fallback));
    return Number.isFinite(n) ? n : fallback;
}

function criarContexto() {
    const cfg = carregarConfigArquivo();
    const tamanhoMaxMb = obterNumero(cfg, 'documentos', 'tamanhoMaxMb', 50);

    return {
        cfg,
        integracao: {
            chaveGemini: obterCampo(cfg, 'integracao', 'chaveGemini'),
            urlPlanilha: obterCampo(cfg, 'integracao', 'urlPlanilha'),
        },
        caminhos: {
            pastaDocumentos: obterCaminho(cfg, 'caminhos', 'pastaDocumentos'),
            prompt: obterCaminho(cfg, 'caminhos', 'prompt'),
            log: obterCaminho(cfg, 'caminhos', 'log'),
            erroLog: obterCaminho(cfg, 'caminhos', 'erroLog'),
        },
        gemini: {
            modelo: obterCampo(cfg, 'gemini', 'modelo', 'gemini-2.5-flash'),
            client: null,
            model: null,
        },
        triagem: {
            intervaloPastasMs: obterNumero(cfg, 'triagem', 'intervaloPastasMs', 15000),
            retryTentativas: obterNumero(cfg, 'triagem', 'retryTentativas', 3),
            retryIntervaloMs: obterNumero(cfg, 'triagem', 'retryIntervaloMs', 5000),
        },
        planilha: {
            postar: obterBoolean(cfg, 'planilha', 'postar', true),
        },
        documentos: {
            validarTamanho: obterBoolean(cfg, 'documentos', 'validarTamanho', true),
            tamanhoMaxMb,
            tamanhoMaxBytes: Math.floor(tamanhoMaxMb * 1024 * 1024),
        },
    };
}

function inicializarGemini(ctx) {
    ctx.gemini.client = new GoogleGenerativeAI(ctx.integracao.chaveGemini);
    ctx.gemini.model = ctx.gemini.client.getGenerativeModel({ model: ctx.gemini.modelo });
}

// =============================================================================
// Resultados (padrão de retorno)
// =============================================================================

function resultadoSucesso(status) {
    return { sucesso: true, status };
}

function resultadoFalha(numPasta, erro) {
    return { sucesso: false, erro: { numPasta, ...erro } };
}

function erroSemRetry(stage, message, extra = {}) {
    return { stage, semRetry: true, message, extra };
}

function erroComRetry(stage, message, extra = {}) {
    return { stage, message, extra };
}

// =============================================================================
// Utilitários
// =============================================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function bytesParaMb(bytes) {
    return Number((bytes / 1024 / 1024).toFixed(2));
}

function montarCaminhoPasta(ctx, numPasta) {
    return path.join(ctx.caminhos.pastaDocumentos, String(numPasta));
}

// =============================================================================
// Logging e persistência de erros
// =============================================================================

function gravarLog(ctx, mensagem) {
    const timestamp = new Date().toLocaleString('pt-BR');
    fs.appendFileSync(ctx.caminhos.log, `[${timestamp}] ${mensagem}\n`);
}

function logConsoleEArquivo(ctx, mensagem) {
    console.log(mensagem);
    gravarLog(ctx, mensagem);
}

function gravarErroFinal(ctx, { numPasta, stage, message, extra, tentativas }) {
    const entry = {
        timestamp: new Date().toISOString(),
        numPasta: numPasta || null,
        stage,
        message,
        tentativas: tentativas || 1,
        ...(extra || {}),
    };
    fs.appendFileSync(ctx.caminhos.erroLog, `${JSON.stringify(entry)}\n`);
}

function arquivarArquivoLog(src, ts) {
    if (!fs.existsSync(src)) return;
    try {
        if (fs.statSync(src).size === 0) return;
    } catch {
        return;
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
        console.warn(`⚠️ [ARCHIVE] Falha ao arquivar ${src}: ${err.message}`);
    }
}

function arquivarLogsAnteriores(ctx) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    arquivarArquivoLog(ctx.caminhos.log, ts);
    arquivarArquivoLog(ctx.caminhos.erroLog, ts);
}

// =============================================================================
// Validações de pasta e documentos
// =============================================================================

function validarCaminhoPasta(caminhoPasta) {
    if (typeof caminhoPasta !== 'string' || caminhoPasta.trim() === '') {
        return {
            ok: false,
            erro: erroSemRetry('invalid_path', `Caminho de pasta inválido: ${String(caminhoPasta)}`, {
                caminhoPasta: caminhoPasta ?? null,
            }),
        };
    }

    if (!fs.existsSync(caminhoPasta)) {
        return {
            ok: false,
            erro: erroSemRetry('invalid_path', `Pasta não encontrada: ${caminhoPasta}`, { caminhoPasta }),
        };
    }

    try {
        if (!fs.lstatSync(caminhoPasta).isDirectory()) {
            return {
                ok: false,
                erro: erroSemRetry('invalid_path', `Caminho não é diretório: ${caminhoPasta}`, { caminhoPasta }),
            };
        }
    } catch (e) {
        return {
            ok: false,
            erro: erroSemRetry('invalid_path', `Falha ao validar caminho da pasta: ${e.message}`, { caminhoPasta }),
        };
    }

    return { ok: true };
}

function listarArquivosDaPasta(caminhoPasta) {
    try {
        return { ok: true, arquivos: fs.readdirSync(caminhoPasta) };
    } catch (e) {
        return {
            ok: false,
            erro: erroComRetry('read_dir', `Falha ao ler pasta: ${e.message}`, { caminhoPasta }),
        };
    }
}

function encontrarArquivosFaltantes(arquivos, obrigatorios) {
    const nomesLower = new Set(arquivos.map((f) => f.toLowerCase()));
    return obrigatorios.filter((nome) => !nomesLower.has(nome.toLowerCase()));
}

function validarArquivosObrigatorios(arquivos) {
    const faltantes = encontrarArquivosFaltantes(arquivos, ARQUIVOS_PDF_OBRIGATORIOS);
    if (faltantes.length === 0) {
        return { ok: true };
    }
    return {
        ok: false,
        erro: erroComRetry(
            'missing_files',
            `Arquivos obrigatórios ausentes: ${faltantes.join(', ')}`,
            { arquivosFaltantes: faltantes },
        ),
    };
}

function obterTamanhoArquivo(caminhoArquivo) {
    try {
        return fs.statSync(caminhoArquivo).size;
    } catch {
        return null;
    }
}

function validarTamanhoDocumentos(ctx, caminhoPasta, nomesArquivos) {
    if (!ctx.documentos.validarTamanho) {
        return { ok: true };
    }

    const { tamanhoMaxBytes, tamanhoMaxMb } = ctx.documentos;
    const arquivosExcedidos = [];

    for (const nome of nomesArquivos) {
        const caminhoArquivo = path.join(caminhoPasta, nome);
        const tamanhoBytes = obterTamanhoArquivo(caminhoArquivo);
        if (tamanhoBytes == null || tamanhoBytes <= tamanhoMaxBytes) continue;

        arquivosExcedidos.push({
            arquivo: nome,
            caminhoArquivo,
            tamanhoBytes,
            tamanhoMB: bytesParaMb(tamanhoBytes),
            limiteMB: tamanhoMaxMb,
        });
    }

    if (arquivosExcedidos.length === 0) {
        return { ok: true };
    }

    const lista = arquivosExcedidos
        .map((a) => `${a.arquivo} (${a.tamanhoMB} MB, limite ${a.limiteMB} MB)`)
        .join('; ');

    return {
        ok: false,
        erro: erroSemRetry(
            'file_too_large',
            `Documento(s) excedem o tamanho maximo permitido: ${lista}`,
            { arquivosExcedidos, limiteMB: tamanhoMaxMb },
        ),
    };
}

function aplicarValidacao(numPasta, validacao) {
    return validacao.ok ? null : resultadoFalha(numPasta, validacao.erro);
}

// =============================================================================
// Gemini e parse da resposta
// =============================================================================

function lerPdfComoInlineData(caminhoPasta, nomeArquivo) {
    const caminhoCompleto = path.join(caminhoPasta, nomeArquivo);
    return {
        inlineData: {
            mimeType: 'application/pdf',
            data: fs.readFileSync(caminhoCompleto).toString('base64'),
        },
    };
}

function montarPartesPdf(caminhoPasta, nomesArquivos) {
    return nomesArquivos.map((nome) => lerPdfComoInlineData(caminhoPasta, nome));
}

function aplicarNumPastaNoPrompt(promptTemplate, numPasta) {
    return promptTemplate.replace('{{numPasta}}', numPasta);
}

async function chamarGemini(ctx, partesPdf, promptFinal) {
    try {
        const result = await ctx.gemini.model.generateContent([...partesPdf, { text: promptFinal }]);
        return { ok: true, result };
    } catch (err) {
        return { ok: false, erro: erroComRetry('gemini_call', err.message) };
    }
}

function extrairTextoResposta(result) {
    try {
        return { ok: true, texto: result.response.text().trim() };
    } catch (err) {
        return {
            ok: false,
            erro: erroComRetry('parse_response', `Falha ao ler resposta da IA: ${err.message}`),
        };
    }
}

function extrairLinhaPipeFinal(respostaTexto) {
    const linhas = respostaTexto.split('\n').filter((l) => l.includes('|'));
    if (linhas.length === 0) {
        return {
            ok: false,
            erro: erroComRetry('parse_response', 'IA retornou resposta em formato inválido.', { respostaTexto }),
        };
    }
    return { ok: true, linhaFinal: linhas[linhas.length - 1].trim() };
}

function extrairStatusDaLinha(linhaFinal) {
    const partes = linhaFinal.split('|');
    return partes[8] || 'Processado';
}

function normalizarTextoColuna(valor) {
    return String(valor || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function valorIndicaAusencia(valor) {
    const v = normalizarTextoColuna(valor);
    return v === '' || v === '---' || v === 'ausencia' || v === 'nao encontrado';
}

function contratoSocialNaoSeAplica(valor) {
    const v = normalizarTextoColuna(valor);
    return v.includes('nao se aplica');
}

function parsearLinhaResultado(linhaFinal) {
    const partes = linhaFinal.split('|').map((p) => p.trim());
    return {
        partes,
        documentacaoCompleta: partes[6],
        status: partes[8],
        motivo: partes[10],
        pagRequerimento: partes[11],
        pagCnpjOuIdentidade: partes[12],
        pagContratoSocial: partes[13],
    };
}

function detectarAusenciasObrigatorias(campos) {
    const ausencias = [];
    if (valorIndicaAusencia(campos.pagRequerimento)) {
        ausencias.push('Requerimento');
    }
    if (valorIndicaAusencia(campos.pagCnpjOuIdentidade)) {
        ausencias.push('CNPJ/Identidade');
    }
    if (!contratoSocialNaoSeAplica(campos.pagContratoSocial) && valorIndicaAusencia(campos.pagContratoSocial)) {
        ausencias.push('Contrato Social');
    }
    return ausencias;
}

function aplicarRegrasConsistenciaBdd(ctx, linhaFinal) {
    const campos = parsearLinhaResultado(linhaFinal);
    if (campos.partes.length < 14) {
        return { linhaFinal, corrigido: false };
    }

    const ausencias = detectarAusenciasObrigatorias(campos);
    if (ausencias.length === 0) {
        return { linhaFinal, corrigido: false };
    }

    const statusAtual = normalizarTextoColuna(campos.status);
    const docCompletaAtual = normalizarTextoColuna(campos.documentacaoCompleta);
    const statusInvalidoParaAusencia =
        statusAtual.includes('valido') ||
        statusAtual.includes('divergencia de dados') ||
        docCompletaAtual === 'sim';

    if (!statusInvalidoParaAusencia) {
        return { linhaFinal, corrigido: false };
    }

    campos.partes[6] = 'Não';
    campos.partes[8] = 'Ausência de doc obrigatório';
    campos.partes[10] =
        `Correção automática: ausência de ${ausencias.join(', ')} no docbasico.pdf. ` +
        `(IA havia retornado Status="${campos.status}" / DocCompleta="${campos.documentacaoCompleta}")`;

    const linhaCorrigida = campos.partes.join('|');
    gravarLog(
        ctx,
        `⚙️ [CORRECAO BDD] Ausência detectada (${ausencias.join(', ')}): linha ajustada para DocCompleta=Não e Status=Ausência de doc obrigatório.`,
    );

    return { linhaFinal: linhaCorrigida, corrigido: true, ausencias };
}

function montarPayloadPlanilha(numPasta, respostaIA) {
    return { numPasta, respostaIA };
}

// =============================================================================
// Planilha
// =============================================================================

async function postarNaPlanilha(ctx, payload, rotulo = 'PLANILHA') {
    const body = JSON.stringify(payload);

    if (!ctx.planilha.postar) {
        const msg = `📋 [DRY-RUN ${rotulo}] ${body}`;
        logConsoleEArquivo(ctx, msg);
        return { ok: true, dryRun: true };
    }

    try {
        const resp = await fetch(ctx.integracao.urlPlanilha, { method: 'POST', body });
        if (!resp.ok) {
            return { ok: false, httpStatus: resp.status, message: `Status HTTP ${resp.status}` };
        }
        return { ok: true, httpStatus: resp.status };
    } catch (err) {
        return { ok: false, message: err.message };
    }
}

function resultadoErroPlanilha(numPasta, resultadoPost, payload) {
    if (resultadoPost.httpStatus) {
        return resultadoFalha(
            numPasta,
            erroComRetry('planilha_http', resultadoPost.message, {
                httpStatus: resultadoPost.httpStatus,
                dados: payload,
            }),
        );
    }
    return resultadoFalha(
        numPasta,
        erroComRetry('planilha_post', resultadoPost.message, { dados: payload }),
    );
}

async function postarErroPlanilha(ctx, numPasta, erro) {
    const mensagem = (erro && erro.message) || 'Erro desconhecido';
    const payload = {
        numPasta,
        respostaIA: `${numPasta}|---|---|---|---|---|---|---|ERRO|0|${mensagem}|---|---|---|---|---`,
    };

    const resultado = await postarNaPlanilha(ctx, payload, `ERRO Pasta ${numPasta}`);
    if (resultado.dryRun) return;

    if (resultado.ok) {
        gravarLog(ctx, `📤 [PLANILHA-ERRO] Pasta ${numPasta} reportada como ERRO na planilha.`);
        return;
    }
    if (resultado.httpStatus) {
        gravarLog(ctx, `⚠️ [PLANILHA-ERRO] Falha HTTP ${resultado.httpStatus} ao reportar pasta ${numPasta}.`);
        return;
    }
    gravarLog(ctx, `⚠️ [PLANILHA-ERRO] Falha ao reportar pasta ${numPasta}: ${resultado.message}`);
}

// =============================================================================
// Processamento de uma pasta
// =============================================================================

function validarPreRequisitosPasta(numPasta, caminhoPasta) {
    const falhaCaminho = aplicarValidacao(numPasta, validarCaminhoPasta(caminhoPasta));
    if (falhaCaminho) return falhaCaminho;

    const listagem = listarArquivosDaPasta(caminhoPasta);
    if (!listagem.ok) return resultadoFalha(numPasta, listagem.erro);

    return aplicarValidacao(numPasta, validarArquivosObrigatorios(listagem.arquivos));
}

async function analisarComGemini(ctx, numPasta, caminhoPasta, promptTemplate) {
    const partesPdf = montarPartesPdf(caminhoPasta, ARQUIVOS_PDF_OBRIGATORIOS);
    const promptFinal = aplicarNumPastaNoPrompt(promptTemplate, numPasta);

    console.log(`🧠 [IA] Analisando ${ARQUIVOS_PDF_OBRIGATORIOS.join(' e ')}...`);

    const chamada = await chamarGemini(ctx, partesPdf, promptFinal);
    if (!chamada.ok) return resultadoFalha(numPasta, chamada.erro);

    const texto = extrairTextoResposta(chamada.result);
    if (!texto.ok) return resultadoFalha(numPasta, texto.erro);

    console.log(`📝 [IA RESPOSTA]:\n${texto.texto}`);

    const linha = extrairLinhaPipeFinal(texto.texto);
    if (!linha.ok) return resultadoFalha(numPasta, linha.erro);

    return { ok: true, linhaFinal: linha.linhaFinal };
}

async function publicarResultadoPlanilha(ctx, numPasta, linhaFinal) {
    const { linhaFinal: linhaAjustada, corrigido } = aplicarRegrasConsistenciaBdd(ctx, linhaFinal);
    if (corrigido) {
        console.log(`⚙️ [CORRECAO BDD] Pasta ${numPasta}: resultado ajustado por ausência de documento obrigatório.`);
    }

    const status = extrairStatusDaLinha(linhaAjustada);
    const payload = montarPayloadPlanilha(numPasta, linhaAjustada);

    gravarLog(ctx, `Resultado Pasta ${numPasta}: Status=${status}`);

    const resultadoPost = await postarNaPlanilha(ctx, payload, `Pasta ${numPasta}`);
    if (!resultadoPost.ok) {
        return resultadoErroPlanilha(numPasta, resultadoPost, payload);
    }

    return resultadoSucesso(status);
}

async function processarPasta(ctx, numPasta, caminhoPasta, promptTemplate) {
    const falhaPre = validarPreRequisitosPasta(numPasta, caminhoPasta);
    if (falhaPre) return falhaPre;

    const falhaTamanho = aplicarValidacao(
        numPasta,
        validarTamanhoDocumentos(ctx, caminhoPasta, ARQUIVOS_PDF_OBRIGATORIOS),
    );
    if (falhaTamanho) return falhaTamanho;

    const analise = await analisarComGemini(ctx, numPasta, caminhoPasta, promptTemplate);
    if (!analise.ok) return resultadoFalha(numPasta, analise.erro);

    return publicarResultadoPlanilha(ctx, numPasta, analise.linhaFinal);
}

// =============================================================================
// Orquestração da triagem (filas, retries, relatório final)
// =============================================================================

function rotuloFalhaSemRetry(stage) {
    const rotulos = {
        invalid_path: 'CAMINHO INVALIDO',
        file_too_large: 'DOCUMENTO GRANDE',
    };
    return rotulos[stage] || 'FALHA DEFINITIVA';
}

function criarGerenciadorFilas(ctx) {
    const filaRetry = [];
    const filaErroDefinitivo = [];

    function encaminharFalha({ numPasta, tentativaAtual, ultimoErro }) {
        if (ultimoErro?.semRetry) {
            const rotulo = rotuloFalhaSemRetry(ultimoErro.stage);
            logConsoleEArquivo(ctx, `❌ [${rotulo}] Pasta ${numPasta} | ${ultimoErro.message}`);
            filaErroDefinitivo.push({ numPasta, tentativaAtual, ultimoErro });
            return;
        }
        filaRetry.push({ numPasta, tentativaAtual, ultimoErro });
    }

    return { filaRetry, filaErroDefinitivo, encaminharFalha };
}

function logInicioAuditoria(ctx, numPasta, caminhoPasta) {
    console.log(`\n--- 🔎 AUDITORIA BDD: Pasta ${numPasta} ---`);
    gravarLog(ctx, `Iniciando análise da Pasta: ${numPasta} | caminho=${caminhoPasta}`);
    console.log(`📂 [CAMINHO] Pasta ${numPasta} | caminho=${caminhoPasta}`);
}

function logInicioRetry(ctx, rodada, numPasta, caminhoPasta) {
    console.log(`\n--- 🔁 RETRY ${rodada}: Pasta ${numPasta} ---`);
    gravarLog(ctx, `Retry ${rodada} da Pasta: ${numPasta} | caminho=${caminhoPasta}`);
    console.log(`📂 [CAMINHO] Pasta ${numPasta} | caminho=${caminhoPasta}`);
}

function registrarResultadoPassada(ctx, filas, numPasta, resultado, tentativaAtual) {
    if (resultado.sucesso) {
        console.log(`✅ [SUCESSO] Status: ${resultado.status}`);
        return { sucesso: true };
    }

    const aviso = `⚠️ [WARN] Pasta ${numPasta} falhou (${resultado.erro.stage}): ${resultado.erro.message}.`;
    logConsoleEArquivo(ctx, aviso);
    filas.encaminharFalha({ numPasta, tentativaAtual, ultimoErro: resultado.erro });
    return { sucesso: false };
}

function registrarResultadoRetry(ctx, filas, rodada, item, resultado) {
    if (resultado.sucesso) {
        const ok = `✅ [RETRY ${rodada}] Pasta ${item.numPasta} OK. Status: ${resultado.status}`;
        logConsoleEArquivo(ctx, ok);
        return { sucesso: true, manterNaFila: false };
    }

    item.tentativaAtual = rodada + 1;
    item.ultimoErro = resultado.erro;

    const aviso = `⚠️ [WARN RETRY ${rodada}] Pasta ${item.numPasta} ainda falhou (${resultado.erro.stage}): ${resultado.erro.message}.`;
    logConsoleEArquivo(ctx, aviso);

    if (resultado.erro?.semRetry) {
        filas.encaminharFalha({
            numPasta: item.numPasta,
            tentativaAtual: item.tentativaAtual,
            ultimoErro: resultado.erro,
        });
        return { sucesso: false, manterNaFila: false };
    }

    return { sucesso: false, manterNaFila: true };
}

function listarPastasNumeradas(ctx) {
    const base = ctx.caminhos.pastaDocumentos;
    return fs
        .readdirSync(base)
        .filter((nome) => fs.lstatSync(path.join(base, nome)).isDirectory());
}

function lerPromptTemplate(ctx) {
    return fs.readFileSync(ctx.caminhos.prompt, 'utf8');
}

function verificarAmbienteInicial(ctx) {
    const pastaDocumentosExiste = fs.existsSync(ctx.caminhos.pastaDocumentos);
    const promptExiste = fs.existsSync(ctx.caminhos.prompt);

    if (pastaDocumentosExiste && promptExiste) {
        return true;
    }

    const erroMsg = '❌ [ERRO] Pasta de documentos ou prompt.txt não encontrados.';
    logConsoleEArquivo(ctx, erroMsg);
    gravarErroFinal(ctx, {
        stage: 'startup',
        message: erroMsg,
        extra: { pastaDocumentosExiste, promptExiste },
    });
    return false;
}

function montarMensagemInicio(ctx) {
    const modoPlanilha = ctx.planilha.postar ? 'POST ativo' : 'DRY-RUN (apenas log JSON)';
    const modoTamanho = ctx.documentos.validarTamanho
        ? `validacao ativa (max ${ctx.documentos.tamanhoMaxMb} MB)`
        : 'validacao de tamanho desativada';

    return (
        `🚀 [SISTEMA] Iniciando Triagem BDD EAA-DVS ` +
        `(modelo=${ctx.gemini.modelo}, planilha=${modoPlanilha}, documentos=${modoTamanho}, ` +
        `intervalo=${ctx.triagem.intervaloPastasMs}ms, ` +
        `retry=${ctx.triagem.retryTentativas}x@${ctx.triagem.retryIntervaloMs}ms)`
    );
}

async function executarPrimeiraPassada(ctx, filas, pastas, promptTemplate) {
    let contadorSucesso = 0;

    for (const numPasta of pastas) {
        const caminhoPasta = montarCaminhoPasta(ctx, numPasta);
        logInicioAuditoria(ctx, numPasta, caminhoPasta);

        const resultado = await processarPasta(ctx, numPasta, caminhoPasta, promptTemplate);
        const registro = registrarResultadoPassada(ctx, filas, numPasta, resultado, 1);
        if (registro.sucesso) contadorSucesso++;

        await sleep(ctx.triagem.intervaloPastasMs);
    }

    return contadorSucesso;
}

async function executarRodadasRetry(ctx, filas, promptTemplate) {
    let contadorSucesso = 0;
    const { retryTentativas, retryIntervaloMs, intervaloPastasMs } = ctx.triagem;

    let rodada = 0;
    while (filas.filaRetry.length > 0 && rodada < retryTentativas) {
        rodada++;
        logConsoleEArquivo(
            ctx,
            `\n🔁 [RETRY ${rodada}/${retryTentativas}] Reprocessando ${filas.filaRetry.length} pasta(s) pendente(s)...`,
        );

        await sleep(retryIntervaloMs);

        const aindaFalhando = [];
        for (const item of filas.filaRetry) {
            const caminhoPasta = montarCaminhoPasta(ctx, item.numPasta);
            logInicioRetry(ctx, rodada, item.numPasta, caminhoPasta);

            const resultado = await processarPasta(ctx, item.numPasta, caminhoPasta, promptTemplate);
            const registro = registrarResultadoRetry(ctx, filas, rodada, item, resultado);

            if (registro.sucesso) contadorSucesso++;
            if (registro.manterNaFila) aindaFalhando.push(item);

            await sleep(intervaloPastasMs);
        }

        filas.filaRetry.length = 0;
        filas.filaRetry.push(...aindaFalhando);
    }

    return contadorSucesso;
}

async function finalizarFalhasDefinitivas(ctx, filas) {
    const filaFalhasFinais = [...filas.filaErroDefinitivo, ...filas.filaRetry];

    for (const item of filaFalhasFinais) {
        gravarErroFinal(ctx, { ...item.ultimoErro, tentativas: item.tentativaAtual });
        gravarLog(
            ctx,
            `❌ [FALHA DEFINITIVA] Pasta ${item.numPasta} apos ${item.tentativaAtual} tentativas: ${item.ultimoErro.message}`,
        );
        await postarErroPlanilha(ctx, item.numPasta, item.ultimoErro);
    }

    return filaFalhasFinais.length;
}

function registrarConclusao(ctx, contadorSucesso, contadorFalha) {
    const fimMsg = `🏁 Triagem concluída. Sucesso: ${contadorSucesso} | Falhas definitivas: ${contadorFalha}`;
    console.log(fimMsg);
    gravarLog(ctx, `${fimMsg}\n${'='.repeat(50)}`);
    if (contadorFalha > 0) {
        console.log(`📄 Detalhes das falhas em: ${ctx.caminhos.erroLog}`);
    }
}

async function processarTriagem() {
    const ctx = criarContexto();
    inicializarGemini(ctx);

    arquivarLogsAnteriores(ctx);
    logConsoleEArquivo(ctx, montarMensagemInicio(ctx));

    if (!verificarAmbienteInicial(ctx)) return;

    const pastas = listarPastasNumeradas(ctx);
    const promptTemplate = lerPromptTemplate(ctx);
    const filas = criarGerenciadorFilas(ctx);

    const sucessoPassada = await executarPrimeiraPassada(ctx, filas, pastas, promptTemplate);
    const sucessoRetry = await executarRodadasRetry(ctx, filas, promptTemplate);
    const contadorFalha = await finalizarFalhasDefinitivas(ctx, filas);

    registrarConclusao(ctx, sucessoPassada + sucessoRetry, contadorFalha);
}

// =============================================================================
// Entry point
// =============================================================================

processarTriagem().catch((err) => {
    console.error('❌ [ERRO FATAL]', err);
    process.exit(1);
});
