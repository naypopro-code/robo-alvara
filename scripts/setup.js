// Roda apos o npm install. Garante que as pastas e o config local existam.
// Pode ser chamado via `npm run setup` ou pelo configurar-projeto-inicial.bat.

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

function ensureDir(rel) {
    const abs = path.join(PROJECT_ROOT, rel);
    if (!fs.existsSync(abs)) {
        fs.mkdirSync(abs, { recursive: true });
        console.log(`[OK] Pasta criada: ${rel}`);
    } else {
        console.log(`[OK] Pasta ja existe: ${rel}`);
    }
}

function copyConfigSampleIfMissing() {
    const sample = path.join(PROJECT_ROOT, 'config', 'config.sample.json');
    const target = path.join(PROJECT_ROOT, 'config', 'config.json');
    if (fs.existsSync(target)) {
        console.log('[OK] config/config.json ja existe — mantido.');
        return false;
    }
    if (!fs.existsSync(sample)) {
        console.error('[ERRO] config/config.sample.json nao encontrado.');
        process.exit(1);
    }
    fs.copyFileSync(sample, target);
    console.log('[OK] config/config.json criado a partir de config.sample.json.');
    return true;
}

console.log('=== Setup do robo-alvara ===');
ensureDir('data');
const created = copyConfigSampleIfMissing();
console.log('=== Setup concluido ===');

if (created) {
    console.log('');
    console.log('Proximos passos:');
    console.log('  1. Edite config/config.json com:');
    console.log('     - CHAVE_GEMINI (API key do Gemini)');
    console.log('     - URL_PLANILHA (Web App do Apps Script)');
    console.log('     - PASTA_RAIZ   (pasta com as subpastas de PDFs)');
    console.log('  2. Rode: npm start  (ou executar.bat no Windows)');
}
