const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { QuickDB } = require("quick.db");
const fs = require("fs");

const db = new QuickDB();
const cooldown = new Set();

const BAUS = JSON.parse(fs.readFileSync("./baus.json", "utf8")).baus;
const BAUS_KEYS = Object.keys(BAUS);
const chaves = {
  bau_comum: "comum_",
  bau_raro: "raro_",
  bau_epico: "epico_",
};

function formatBauInfo(tipo, bau, qtd, multAtivo) {
  return `**Baú:** ${tipo.replace("bau_", "Baú ").toUpperCase()}
**Quantidade:** ${qtd}
**Raridade:** ${bau.raridade || "Desconhecida"}
**Multiplicador ativo:** ${multAtivo ? `${multAtivo.toFixed(2)}x` : "Nenhum"}

${bau.descricao || ""}`;
}

module.exports = {
  name: "abrirbau",
  aliases: [],
  async execute(message, args, client) {
    const userId = message.author.id;
    if (cooldown.has(userId)) {
      return message.reply("⏳ | Espere um momento antes de usar o comando novamente.");
    }

    cooldown.add(userId);
    setTimeout(() => cooldown.delete(userId), 5000);

    const quantidades = {};
    for (const key of BAUS_KEYS) {
      quantidades[key] = (await db.get(`${chaves[key]}${userId}`)) || 0;
    }

    const bausPossuidos = BAUS_KEYS.filter(k => quantidades[k] > 0);
    if (bausPossuidos.length === 0)
      return message.reply("❌ | Você não possui nenhum baú para abrir.");

    const index = 0;
    const tipoAtual = bausPossuidos[index];
    const bauAtual = BAUS[tipoAtual];
    const qtdAtual = quantidades[tipoAtual];
    const multiplicadores = (await db.get(`multiplicadores_${userId}`)) || [];

    const embed = new EmbedBuilder()
      .setTitle("🎁 Abrir Baú")
      .setDescription(formatBauInfo(tipoAtual, bauAtual, qtdAtual, null))
      .setColor("#FFD700");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`abrirbau:voltar:${userId}:${index}`).setLabel("<").setStyle(ButtonStyle.Primary).setDisabled(true),
      new ButtonBuilder().setCustomId(`abrirbau:multiplicador:${userId}:${index}`).setLabel("Multiplicador").setStyle(ButtonStyle.Secondary).setDisabled(multiplicadores.length === 0),
      new ButtonBuilder().setCustomId(`abrirbau:abrir:${userId}:${index}`).setLabel("Abrir Baú").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`abrirbau:avancar:${userId}:${index}`).setLabel(">").setStyle(ButtonStyle.Primary).setDisabled(bausPossuidos.length <= 1),
    );

    await message.channel.send({ embeds: [embed], components: [row] });
  },

  async button(interaction, { action, rest }) {
    if (!interaction.deferred && !interaction.replied) {
  await interaction.deferUpdate().catch(() => {});
    }
    const [userId, indexStr, multStr] = rest;
    if (interaction.user.id !== userId)
      return interaction.reply({ content: "❌ Apenas quem iniciou pode usar esses botões.", ephemeral: true });

    let index = parseInt(indexStr) || 0;
    let multiplicadorAtivo = multStr ? parseFloat(multStr) : null;

    const resolvedBaus = [];
    for (const key of BAUS_KEYS) {
      const qtd = await db.get(`${chaves[key]}${userId}`) || 0;
      if (qtd > 0) resolvedBaus.push(key);
    }

    const totalBaus = resolvedBaus.length;
    if (totalBaus === 0) {
      return interaction.update({
        content: "❌ Você não possui mais baús.",
        embeds: [],
        components: [],
      });
    }

    index = Math.max(0, Math.min(index, totalBaus - 1));
    const tipoAtual = resolvedBaus[index];
    const chave = chaves[tipoAtual];
    let qtdAtual = await db.get(`${chave}${userId}`) || 0;
    let multiplicadores = (await db.get(`multiplicadores_${userId}`)) || [];

    if (action === "voltar") {
      if (index > 0) index--;
      multiplicadorAtivo = null;
    }

    if (action === "avancar") {
      if (index < totalBaus - 1) index++;
      multiplicadorAtivo = null;
    }

    if (action === "multiplicador") {
      if (multiplicadores.length === 0)
        return interaction.reply({ content: "❌ Você não tem multiplicadores disponíveis.", ephemeral: true });

      if (!interaction.deferred && !interaction.replied) {
  await interaction.deferReply({ ephemeral: true });
      }
      await interaction.followUp({
        content: `Seus multiplicadores disponíveis: \`${multiplicadores.join("%, ")}%\`\nDigite o valor desejado (ex: \`50\`) ou "cancelar".`,
      });

      const filter = m => m.author.id === userId;
      try {
        const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ["time"] });
        const content = collected.first().content.toLowerCase();
        if (content === "cancelar") return;

        const valor = parseInt(content);
        if (!valor || !multiplicadores.includes(valor)) {
          return interaction.followUp({ content: "❌ Valor inválido ou não disponível." });
        }

        multiplicadorAtivo = 1 + valor / 100;
        multiplicadores = multiplicadores.filter(m => m !== valor);
        await db.set(`multiplicadores_${userId}`, multiplicadores);

        await interaction.followUp({ content: `✅ Multiplicador de ${valor}% aplicado!` });
      } catch {
        return interaction.followUp({ content: "⏳ Tempo esgotado para aplicar multiplicador." });
      }
    }
    

    if (action === "abrir") {
  if (qtdAtual <= 0)
    return interaction.reply({ content: "❌ Você não tem esse tipo de baú.", ephemeral: true });

  await db.sub(`${chave}${userId}`, 1);
  qtdAtual--;

  const frutasData = JSON.parse(fs.readFileSync("./frutas.json", "utf8"));
  const espadasData = JSON.parse(fs.readFileSync("./espadas.json", "utf8"));
  const equipamentosData = JSON.parse(fs.readFileSync("./equipamentos.json", "utf8"));

  const bau = BAUS[tipoAtual];

  let vezes = 1;
  if (bau.critico && Math.random() < bau.critico.chance) {
    vezes = Math.floor(Math.random() * (bau.critico.bonusMax - bau.critico.bonusMin + 1)) + bau.critico.bonusMin;
    await interaction.followUp({ content: `💥 | **Crítico!** Você receberá \`${vezes}\` recompensas!`, ephemeral: true });
  }

  const rand = arr => arr[Math.floor(Math.random() * arr.length)];

  let recompensas = {
    berries: 0,
    xp: 0,
    xpfruit: 0,
    materiais: 0,
    frutas: [],
    espadas: [],
    equipamentos: []
  };

  for (let i = 0; i < vezes; i++) {
    const q = bau.quantidade;
    if (q) {
      recompensas.berries += Math.floor((Math.random() * (q.berries[1] - q.berries[0] + 1) + q.berries[0]) * (multiplicadorAtivo || 1));
      recompensas.xp += Math.floor((Math.random() * (q.xp[1] - q.xp[0] + 1) + q.xp[0]) * (multiplicadorAtivo || 1));
      recompensas.xpfruit += Math.floor((Math.random() * (q.xpfruit[1] - q.xpfruit[0] + 1) + q.xpfruit[0]) * (multiplicadorAtivo || 1));
      recompensas.materiais += Math.floor((Math.random() * (q.materiais[1] - q.materiais[0] + 1) + q.materiais[0]) * (multiplicadorAtivo || 1));
    }

    if (bau.garantido) {
      if (bau.garantido.frutas) recompensas.frutas.push(...bau.garantido.frutas);
      if (bau.garantido.espadas) recompensas.espadas.push(...bau.garantido.espadas);
      if (bau.garantido.equipamentos) recompensas.equipamentos.push(...bau.garantido.equipamentos);
    }

    if (bau.aleatorio) {
      if (bau.aleatorio.frutas) recompensas.frutas.push(rand(bau.aleatorio.frutas));
      if (bau.aleatorio.espadas) recompensas.espadas.push(rand(bau.aleatorio.espadas));
      if (bau.aleatorio.equipamentos) recompensas.equipamentos.push(rand(bau.aleatorio.equipamentos));
    }
  }

  const frutasInventario = await db.get(`frutas_inventario_${userId}`) || [];
  const slotsFruta = await db.get(`slots_fruta_${userId}`) || 3;
  const espadasAtuais = await db.get(`espadas_${userId}`) || [];
  const equipsAtuais = await db.get(`equipamentos_${userId}`) || [];

  const frutasObtidas = [];
  const novasEspadas = [];
  const novosEquips = [];

  for (const frutaId of recompensas.frutas) {
    if (Math.random() < 0.15 && frutasInventario.length < slotsFruta) {
      const fruta = frutasData.frutas.find(f => f.id === frutaId);
      if (fruta) frutasObtidas.push(fruta);
    }
  }

  for (const espadaId of recompensas.espadas) {
    if (Math.random() < 0.1 && !espadasAtuais.includes(espadaId)) {
      novasEspadas.push(espadaId);
    } else {
      recompensas.berries += 1000;
    }
  }

 // for (const equipId of recompensas.equipamentos) {
   // if (Math.random() < 0.1 && !equipsAtuais.includes(equipId)) {
    //  novosEquips.push(equipId);
    //} else {
   //   recompensas.berries += 800;
//.  }
 // }

  // Ticket multiplicador
  let valorMultiplicador = "nenhum";
  if (bau.ticketsMultiplicador && Math.random() < bau.ticketsMultiplicador.chance) {
    const valores = bau.ticketsMultiplicador.valores;
    valorMultiplicador = rand(valores);
    let tickets = await db.get(`multiplicadores_${userId}`) || [];
    tickets.push(valorMultiplicador);
    await db.set(`multiplicadores_${userId}`, tickets);
  }

  // Aplicar recompensas
  await db.add(`berries_${userId}`, recompensas.berries);
  await db.add(`xp_${userId}`, recompensas.xp);
  await db.add(`xpfruit_${userId}`, recompensas.xpfruit);
  await db.add(`materiais_${userId}`, recompensas.materiais);
  frutasInventario.push(...frutasObtidas);
  await db.set(`frutas_inventario_${userId}`, frutasInventario);
  await db.set(`espadas_${userId}`, espadasAtuais.concat(novasEspadas));
//  await db.set(`equipamentos_${userId}`, equipsAtuais.concat(novosEquips));

  // Resposta animada
  const linhas = [
    `**Multiplicador:** \`${(multiplicadorAtivo || 1).toFixed(2)}x\``,
    `Berries: ${recompensas.berries}`,
    `XP: ${recompensas.xp}`,
    `XP Fruta: ${recompensas.xpfruit}`,
    `Materiais: ${recompensas.materiais}`,
    `Multiplicador ganho: ${valorMultiplicador}`,
    `Frutas: ${frutasObtidas.length ? frutasObtidas.map(f => f.nome).join(", ") : "Nenhuma"}`,
    `Espadas: ${novasEspadas.length ? novasEspadas.map(id => espadasData.espadas.find(e => e.id === id)?.nome || "Desconhecida").join(", ") : "Nenhuma"}`,
    `Equipamentos: ${novosEquips.length ? novosEquips.map(id => equipamentosData.equipamentos.find(e => e.id === id)?.nome || "Desconhecido").join(", ") : "Nenhum"}`
  ];

  const embedMsg = await interaction.channel.send({
  embeds: [new EmbedBuilder().setTitle("Abrindo Baú...").setDescription("🎁 Carregando recompensas...").setColor("#FFD700")]
});

  let i = 0;
  const atualizar = async () => {
    if (i >= linhas.length) return;
    await embedMsg.edit({
      embeds: [new EmbedBuilder().setTitle("🎁 Recompensas do Baú").setDescription(linhas.slice(0, i + 1).join("\n")).setColor("#00FF99")]
    });
    i++;
    setTimeout(atualizar, 1000);
  };

  atualizar();
  multiplicadorAtivo = null;
    } else if (!interaction.deferred && !interaction.replied) {
  await interaction.deferUpdate();
    }

    const embed = new EmbedBuilder()
      .setTitle("🎁 Abrir Baú")
      .setDescription(formatBauInfo(tipoAtual, BAUS[tipoAtual], qtdAtual, multiplicadorAtivo))
      .setColor("#FFD700");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`abrirbau:voltar:${userId}:${index}:${multiplicadorAtivo || ""}`)
        .setLabel("<")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(index === 0),
      new ButtonBuilder()
        .setCustomId(`abrirbau:multiplicador:${userId}:${index}:${multiplicadorAtivo || ""}`)
        .setLabel("Multiplicador")
        .setStyle(multiplicadorAtivo ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(multiplicadores.length === 0),
      new ButtonBuilder()
        .setCustomId(`abrirbau:abrir:${userId}:${index}:${multiplicadorAtivo || ""}`)
        .setLabel("Abrir Baú")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`abrirbau:avancar:${userId}:${index}:${multiplicadorAtivo || ""}`)
        .setLabel(">")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(index >= totalBaus - 1),
    );

    await interaction.message.edit({ embeds: [embed], components: [row] });
    return true;
  },
};