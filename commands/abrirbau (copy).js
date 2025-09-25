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

      await interaction.reply({
        content: `Seus multiplicadores disponíveis: \`${multiplicadores.join("%, ")}%\`\nDigite o valor desejado (ex: \`50\`) ou "cancelar".`,
        ephemeral: true,
      });

      const filter = m => m.author.id === userId;
      try {
        const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ["time"] });
        const content = collected.first().content.toLowerCase();
        if (content === "cancelar") return;

        const valor = parseInt(content);
        if (!valor || !multiplicadores.includes(valor))
          return interaction.followUp({ content: "❌ Valor inválido ou não disponível.", ephemeral: true });

        multiplicadorAtivo = 1 + valor / 100;
        multiplicadores = multiplicadores.filter(m => m !== valor);
        await db.set(`multiplicadores_${userId}`, multiplicadores);

        await interaction.followUp({ content: `✅ Multiplicador de ${valor}% aplicado!`, ephemeral: true });
      } catch {
        return interaction.followUp({ content: "⏳ Tempo esgotado para aplicar multiplicador.", ephemeral: true });
      }
    }

    if (action === "abrir") {
      if (qtdAtual <= 0)
        return interaction.reply({ content: "❌ Você não tem esse tipo de baú.", ephemeral: true });

      await db.sub(`${chave}${userId}`, 1);
      qtdAtual--;

      await interaction.reply({
        content: `🎉 Você abriu um baú **${tipoAtual.replace("bau_", "")}** e recebeu suas recompensas!`,
        ephemeral: true,
      });

      multiplicadorAtivo = null;
    } else {
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