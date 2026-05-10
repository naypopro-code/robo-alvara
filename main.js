const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// --- 1. CONFIGURAÇÕES ---
const CHAVE_GEMINI = ""; 
const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbwJNMdXjtrmTwqY03QConeTjwAb5_N0Q-hvNv9hj7h__Ldcl3Hmlr0OzqIg5dCFjt7Y3g/exec"; 
const PASTA_RAIZ = 'C:\\Users\\nayarapb\\Documents\\Teste_Robo_EAA_DVS\\01_documentos_alvara';
const CAMINHO_PROMPT = path.join(__dirname, 'prompt.txt');
const CAMINHO_LOG = path.join(__dirname, 'log_processamento.txt');

// --- 2. INICIALIZAÇÃO ---
const genAI = new GoogleGenerativeAI(CHAVE_GEMINI);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Função auxiliar para gravar logs
function gravarLog(mensagem) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const linhaLog = `[${timestamp}] ${mensagem}\n`;
    fs.appendFileSync(CAMINHO_LOG, linhaLog);
}

async function processarTriagem() {
    const inicioMsg = "🚀 [SISTEMA] Iniciando Triagem BDD EAA-DVS...";
    console.log(inicioMsg);
    gravarLog(inicioMsg);
    
    if (!fs.existsSync(PASTA_RAIZ) || !fs.existsSync(CAMINHO_PROMPT)) {
        const erroMsg = "❌ [ERRO] Pasta raiz ou prompt.txt não encontrados.";
        console.log(erroMsg);
        gravarLog(erroMsg);
        return;
    }

    const pastas = fs.readdirSync(PASTA_RAIZ).filter(f => fs.lstatSync(path.join(PASTA_RAIZ, f)).isDirectory());
    const promptTemplate = fs.readFileSync(CAMINHO_PROMPT, 'utf8');

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
            const result = await model.generateContent([...pdfsParaEnviar, { text: promptFinal }]);

            let respostaTexto = result.response.text().trim();
            console.log(`📝 [IA RESPOSTA]:\n${respostaTexto}`);
            
            const linhas = respostaTexto.split('\n').filter(l => l.includes('|'));
            if (linhas.length === 0) throw new Error("IA retornou resposta em formato inválido.");

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

            const responsePlanilha = await fetch(URL_PLANILHA, {
                method: 'POST',
                body: JSON.stringify(dadosParaPlanilha)
            });

            if (responsePlanilha.ok) {
                console.log(`✅ [SUCESSO] Status: ${dadosParaPlanilha.status}`);
            } else {
                gravarLog(`Erro Planilha Pasta ${numPasta}: Status HTTP ${responsePlanilha.status}`);
            }

            await new Promise(r => setTimeout(r, 2000));

        } catch (err) {
            const erroMsg = `❌ [ERRO] Pasta ${numPasta}: ${err.message}`;
            console.error(erroMsg);
            gravarLog(erroMsg);
        }
    }
    const fimMsg = "🏁 Triagem concluída.";
    console.log(fimMsg);
    gravarLog(fimMsg + "\n" + "=".repeat(50));
}

processarTriagem();