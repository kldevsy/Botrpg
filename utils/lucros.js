const fs = require("fs");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

function getDia() {
  const agora = new Date();
  return `${agora.getFullYear()}-${agora.getMonth() + 1}-${agora.getDate()}`;
}

function getSemana() {
  const agora = new Date();
  const firstDayOfYear = new Date(agora.getFullYear(), 0, 1);
  const pastDaysOfYear = Math.floor((agora - firstDayOfYear) / 86400000);
  return `${agora.getFullYear()}-S${Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)}`;
}

async function distribuirLucros() {
  let ilhas = await db.get("ilhas_data");
//console.log(ilhas)
  if (!ilhas || !Array.isArray(ilhas) || ilhas.length === 0) {
    try {
      const dadosJSON = JSON.parse(fs.readFileSync("./ilhas.json", "utf8"));
      ilhas = dadosJSON.ilhas || [];
      await db.set("ilhas_data", ilhas);
      console.log("📁 Ilhas carregadas do JSON para o banco.");
    } catch (e) {
      console.error("❌ Erro ao carregar ilhas.json:", e);
      return;
    }
  }

  const ganhos = {};
  const hoje = getDia();
  const semana = getSemana();

  // Eventos Raros
  let evento = "normal";
  const chance = Math.random();
  if (chance < 0.05) evento = "boom";
  else if (chance < 0.1) evento = "crash";

  console.log(`📊 Evento de Mercado: ${evento.toUpperCase()}`);

  for (const ilha of ilhas) {
  const base = ilha.rendaBase || 0;
  const lucroPercentual = ilha.lucroPercentual || 0;
  const participacoes = ilha.participacoes || {};
  const tributacao = ilha.tributacao || 0; // padrão 0 se não tiver

  // Se não tiver participações, assume o dono com 100%
  if (Object.keys(participacoes).length === 0 && ilha.dono) {
    participacoes[ilha.dono] = 100;
  }

  // Lucro bruto da ilha
  let lucroTotal = Math.floor(base * (lucroPercentual / 100));

  // Aplicar eventos e tendência
  let modificador = 1;
  if (ilha.tendencia === "subindo") {
    modificador += ilha.popularidade * 0.05;
  } else if (ilha.tendencia === "caindo") {
    modificador -= (6 - ilha.popularidade) * 0.05;
    if (lucroPercentual < 8 && Math.random() < 0.5) lucroTotal *= -1;
  }
  if (evento === "boom") {
    modificador *= 1.5;
  } else if (evento === "crash") {
    modificador *= 0.4;
    if (Math.random() < 0.3) lucroTotal *= -1;
  }

  lucroTotal = Math.floor(lucroTotal * modificador);

  // Aplicar tributação
  const valorTributado = Math.floor(lucroTotal * (tributacao / 100));
  const lucroLiquido = lucroTotal - valorTributado;

  // Você pode armazenar esse valor tributado em uma variável separada
  // Ex: tesouro_nacional += valorTributado;

  for (const [userId, participacao] of Object.entries(participacoes)) {
    const resultado = Math.floor(lucroLiquido * (participacao / 100));
    ganhos[userId] = (ganhos[userId] || 0) + resultado;

    // Log individual por ilha
    ilha.logs = ilha.logs || {};
    ilha.logs[userId] = ilha.logs[userId] || { lucroTotal: 0, perdas: 0 };

    if (resultado >= 0) {
      ilha.logs[userId].lucroTotal += resultado;
    } else {
      ilha.logs[userId].perdas += Math.abs(resultado);
    }

    console.log(`💼 Ilha "${ilha.nome}" (${ilha.estado} | ${ilha.tendencia}) para <@${userId}>:
 - Base: ${base}
 - Lucro Bruto: ${lucroTotal + valorTributado}
 - Tributação: ${tributacao}% (-${valorTributado})
 - Lucro Líquido: ${lucroLiquido}
 - Participação: ${participacao}%
 - Resultado: ${resultado >= 0 ? `+${resultado}` : `-${Math.abs(resultado)}`} Berries`);
  }
  }

  // Salva logs atualizados
  await db.set("ilhas_data", ilhas);

  for (const [userId, valor] of Object.entries(ganhos)) {
    const atual = await db.get(`lucro_acumulado_${userId}`) || 0;
    await db.set(`lucro_acumulado_${userId}`, atual + valor);

    // Histórico por dia
    const histDia = await db.get(`lucro_historico_dia_${userId}`) || {};
    histDia[hoje] = (histDia[hoje] || 0) + valor;
    await db.set(`lucro_historico_dia_${userId}`, histDia);

    // Histórico por semana
    const histSem = await db.get(`lucro_historico_semana_${userId}`) || {};
    histSem[semana] = (histSem[semana] || 0) + valor;
    await db.set(`lucro_historico_semana_${userId}`, histSem);
  }

  console.log(`✅ Lucros distribuídos para ${Object.keys(ganhos).length} usuários.`);
}


module.exports = {
  getDia,
  getSemana,
  distribuirLucros
};