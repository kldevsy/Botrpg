const { QuickDB } = require("quick.db");
const { EmbedBuilder } = require("discord.js");
const db = new QuickDB();

console.log("✅ Módulo resultado.js carregado!");

const canalRoletaId = "751325205007302729"; // ID do canal da roleta

function gerarResultado() {
  console.log("🎯 Sorteando cor e número...");
  const opcoes = ["🟥", "⬛", "⬜"];
  const corSorteada = opcoes[Math.floor(Math.random() * opcoes.length)];
  const numeroSorteado = Math.floor(Math.random() * 100) + 1;
  return { cor: corSorteada, numero: numeroSorteado };
}

 async function processarResultado(client) {
  console.log("📊 Processando resultado da roleta...");

  const rodada = await db.get("roleta_rodada") || {};
  const apostas = rodada.apostas || [];

  if (!apostas.length) {
    console.log("⚠️ Nenhuma aposta encontrada. Pulando resultado, mas iniciando nova rodada.");

    // Inicia nova rodada mesmo sem apostas
    const novaRodada = {
      tempo: Date.now() + 5 * 60 * 1000, // 5 minutos depois
      encerrada: false,
      apostas: []
    };
    await db.set("roleta_rodada", novaRodada);

    console.log("✅ Nova rodada iniciada automaticamente.");
    return;
  }

  const { cor, numero } = gerarResultado();
  const totalApostado = apostas.reduce((t, a) => t + a.valor, 0);
  const vencedores = [];

  for (const aposta of apostas) {
    let multiplicador = 0;

    if (aposta.cor && aposta.cor === cor) multiplicador += 2;
    if (aposta.numero && aposta.numero === numero) {
      multiplicador += 2;
    } else if (aposta.numero && Math.abs(aposta.numero - numero) <= 3) {
      multiplicador += 1.5;
    }

    if (cor === "⬜") multiplicador = 15;

    const ganho = Math.floor(aposta.valor * multiplicador);

    if (ganho > 0) {
      vencedores.push({ userId: aposta.userId, ganho });
      const atual = await db.get(`berries_${aposta.userId}`) || 0;
      await db.set(`berries_${aposta.userId}`, atual + ganho);
    }
  }

  // Salva histórico
  let historico = (await db.get("roleta_historico")) || [];
  historico.unshift({ cor, numero, totalApostado, jogadores: apostas.length });
  historico = historico.slice(0, 10);
  await db.set("roleta_historico", historico);

  const embed = new EmbedBuilder()
    .setTitle("🎲 | Resultado da Roleta")
    .setColor("Red")
    .setDescription(
      `Cor sorteada: ${cor}\nNúmero sorteado: **${numero}**\n\n` +
      `Total apostado: **${totalApostado.toLocaleString()} berries**\n` +
      `Total de jogadores: **${apostas.length}**\n\n` +
      (vencedores.length
        ? vencedores.map(v => `<@${v.userId}> ganhou **${v.ganho.toLocaleString()} berries**`).join("\n")
        : "Ninguém venceu desta vez. 🎰")
    )
    .setTimestamp();

  try {
    const canal = await client.channels.fetch(canalRoletaId);
    if (canal) await canal.send({ embeds: [embed] });
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem no canal da roleta:", err);
  }

  // Inicia nova rodada
  const novaRodada = {
    tempo: Date.now() + 5 * 60 * 1000,
    encerrada: false,
    apostas: []
  };
  await db.set("roleta_rodada", novaRodada);

  console.log("✅ Resultado processado e nova rodada iniciada.");
 }
module.exports = { processarResultado };