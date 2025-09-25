const { EmbedBuilder } = require("discord.js");
const { QuickDB } = require("quick.db");
const fs = require("fs");
const db = new QuickDB();

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function atualizarIlhas(client) {
  let ilhas = await db.get("ilhas_data");

  // Fallback: carrega do JSON se estiver vazio ou ausente
  if (!ilhas || !Array.isArray(ilhas) || ilhas.length === 0) {
    try {
      const dadosJSON = JSON.parse(fs.readFileSync("./ilhas.json", "utf8"));
      ilhas = dadosJSON.ilhas || [];
      await db.set("ilhas_data", ilhas);
      console.log("📁 Dados de ilhas carregados do ilhas.json e salvos no banco.");
      return;
    } catch (e) {
      console.error("❌ Erro ao carregar ilhas.json:", e);
      return;
    }
  }

  const jornal = [];
  const quantidade = getRandomInt(1, 5);
  const selecionadas = [];

  while (selecionadas.length < quantidade) {
    const index = getRandomInt(0, ilhas.length - 1);
    if (!selecionadas.includes(index)) selecionadas.push(index);
  }

  selecionadas.forEach((i) => {
    const ilha = ilhas[i];
    const antes = { ...ilha };

    const chance = Math.random();
    if (chance < 0.25) ilha.tendencia = "subindo";
    else if (chance < 0.5) ilha.tendencia = "caindo";
    else ilha.tendencia = "estável";

    let variacao = 0;
    if (ilha.tendencia === "subindo") {
      variacao = 1 + Math.random() * 0.15;
    } else if (ilha.tendencia === "caindo") {
      variacao = 1 - Math.random() * 0.15;
    } else {
      variacao = 1 + (Math.random() * 0.04 - 0.02);
    }

    ilha.valorMercado = Math.max(100000, Math.round(ilha.valorMercado * variacao));

    if (ilha.tendencia === "subindo" && Math.random() < 0.5) ilha.lucroPercentual += 1;
    else if (ilha.tendencia === "caindo" && Math.random() < 0.5) ilha.lucroPercentual -= 1;

    ilha.lucroPercentual = Math.max(5, Math.min(20, ilha.lucroPercentual));
    ilha.rendaBase = Math.round((ilha.valorMercado * ilha.lucroPercentual) / 100 / 10);
    ilha.estado = ilha.tendencia === "subindo" ? "📈" : ilha.tendencia === "caindo" ? "📉" : "📊";

    if (ilha.tendencia === "subindo" && ilha.lucroPercentual > 12 && Math.random() < 0.5) {
      ilha.popularidade = Math.min(5, ilha.popularidade + 1);
    } else if (ilha.tendencia === "caindo" && ilha.lucroPercentual < 9 && Math.random() < 0.5) {
      ilha.popularidade = Math.max(1, ilha.popularidade - 1);
    }

    const diferencaValor = ilha.valorMercado - antes.valorMercado;
    const diferencaLucro = ilha.lucroPercentual - antes.lucroPercentual;
    const diferencaPopularidade = ilha.popularidade - antes.popularidade;
// Atualiza tributação com base no valor da ilha (exemplo inteligente)
ilha.tributacao = Math.max(1, Math.round((ilha.valorMercado / 1000) * 2)); // Ex: 2% por cada 1kk de valor
    const log = `📍 **${ilha.nome}**
📊 Estado: ${antes.estado} → ${ilha.estado} | Tendência: \`${ilha.tendencia}\`
💰 Valor: \`${antes.valorMercado.toLocaleString()} → ${ilha.valorMercado.toLocaleString()} (${diferencaValor >= 0 ? "🔼 +" : "🔽"}${Math.abs(diferencaValor).toLocaleString()})\`
📈 Lucro: \`${antes.lucroPercentual}% → ${ilha.lucroPercentual}% (${diferencaLucro >= 0 ? "🟢 +" : "🔴"}${Math.abs(diferencaLucro)}%)\`
🌟 Popularidade: \`${antes.popularidade} → ${ilha.popularidade} (${diferencaPopularidade > 0 ? "📈 subiu" : diferencaPopularidade < 0 ? "📉 caiu" : "➖ estável"})\``;

    jornal.push(log);
  });

  await db.set("ilhas_data", ilhas); // Atualiza as ilhas no banco

  const embed = new EmbedBuilder()
    .setTitle("📰 Jornal do Mercado")
    .setDescription(jornal.join("\n\n"))
    .setColor("Yellow")
    .setFooter({ text: `Atualização automática do sistema de ilhas` })
    .setTimestamp();

  const canal = await client.channels.fetch("751304354694299670").catch(() => null);
  if (canal && canal.send) canal.send({ embeds: [embed] });
}

module.exports = { atualizarIlhas };