const { GoogleGenerativeAI } = require("@google/generative-ai");
const { carregarConfigArquivo, obterCampo } = require('./carregarConfig');

const cfg = carregarConfigArquivo();
const CHAVE_GEMINI = obterCampo(cfg, 'integracao', 'CHAVE_GEMINI');

const genAI = new GoogleGenerativeAI(CHAVE_GEMINI);

async function listarModelos() {
    try {
        console.log("🔍 Consultando modelos disponíveis para sua chave...");
        
        // No SDK do Node.js, usamos o método listModels através de um cliente de administração ou via comando direto
        // Mas a forma mais simples de validar é tentar instanciar e ver o erro ou sucesso.
        // Vamos usar a rota de descoberta:
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${CHAVE_GEMINI}`);
        const data = await response.json();

        if (data.models) {
            console.log("✅ Modelos encontrados:");
            data.models.forEach(m => {
                console.log(`- ${m.name.replace('models/', '')} (Suporta: ${m.supportedGenerationMethods.join(', ')})`);
            });
        } else {
            console.log("❌ Nenhum modelo encontrado. Verifique sua chave.");
            console.log("Resposta do Google:", data);
        }
    } catch (err) {
        console.error("❌ Erro ao listar modelos:", err.message);
    }
}

listarModelos();