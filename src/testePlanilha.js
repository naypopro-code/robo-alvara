// --- SCRIPT DE TESTE DE CONEXÃO COM A PLANILHA ---

const fs = require('fs');
const path = require('path');

const CAMINHO_CONFIG = path.join(__dirname, '..', 'config', 'config.json');
let cfg;
try {
    cfg = JSON.parse(fs.readFileSync(CAMINHO_CONFIG, 'utf8'));
} catch (e) {
    console.error(`❌ [ERRO] config.json nao encontrado: ${CAMINHO_CONFIG}`);
    console.error('    Rode exec\\configurar-projeto-inicial.bat primeiro.');
    process.exit(1);
}
const URL_PLANILHA = cfg.URL_PLANILHA;

async function enviarTeste() {
    console.log("🔗 Tentando conexão com a planilha...");

    const dadosDeTeste = {
        numPasta: "TESTE-01",
        dataEmail: "26/04/2026",
        email: "teste@email.com.br", // Verifique se este campo aparece na sua planilha
        cnpj: "00.000.000/0001-00",
        razao: "EMPRESA TESTE LTDA",
        endereco: "RUA DOS TESTES, 123",
        docCompleta: "Sim",
        analiseAtividade: "99.99-9-99",
        status: "Conexão OK"
    };

    try {
        const response = await fetch(URL_PLANILHA, {
            method: 'POST',
            body: JSON.stringify(dadosDeTeste)
        });

        if (response.ok) {
            console.log("✅ SUCESSO: Os dados foram enviados para o Google Sheets.");
            console.log("Verifique sua planilha agora!");
        } else {
            console.log("❌ ERRO NA PLANILHA: Status", response.status);
        }
    } catch (err) {
        console.error("❌ ERRO DE CONEXÃO:", err.message);
    }
}

enviarTeste();