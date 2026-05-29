const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const CAMINHO_CONFIG = path.join(PROJECT_ROOT, 'config', 'config.json');

function carregarConfigArquivo() {
    let cfgRaw;
    try {
        cfgRaw = fs.readFileSync(CAMINHO_CONFIG, 'utf8');
    } catch (e) {
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

/** Lê campo no grupo ou na raiz (compatibilidade com config antigo plano) */
function obterCampo(cfg, grupo, campo, fallback) {
    const g = cfg[grupo];
    if (g && typeof g === 'object' && !Array.isArray(g) && g[campo] !== undefined && g[campo] !== null) {
        return g[campo];
    }
    if (cfg[campo] !== undefined && cfg[campo] !== null) {
        return cfg[campo];
    }
    return fallback;
}

function obterCampoObrigatorio(cfg, grupo, campo) {
    const valor = obterCampo(cfg, grupo, campo);
    if (valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')) {
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
    const valor = obterCampo(cfg, grupo, campo, fallback);
    const n = Number(valor);
    return Number.isFinite(n) ? n : fallback;
}

module.exports = {
    PROJECT_ROOT,
    CAMINHO_CONFIG,
    carregarConfigArquivo,
    obterCampo,
    obterCampoObrigatorio,
    obterCaminho,
    obterBoolean,
    obterNumero,
    resolverCaminho,
};
