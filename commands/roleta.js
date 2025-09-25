const {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle
} = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = {
  name: "roleta",
  description: "Exibe o status da roleta atual.",
  aliases: ["roletar"],

  async execute(message, args, client) {
    const rodada = await db.get("roleta_rodada") || { apostas: [], tempo: Date.now() + 5 * 60 * 1000, encerrada: false };
    const tempoRestante = rodada.tempo - Date.now();

    const minutos = Math.max(0, Math.floor(tempoRestante / 60000));
    const segundos = Math.max(0, Math.floor((tempoRestante % 60000) / 1000));

    const embed = new EmbedBuilder()
      .setTitle(`🎲 Roleta - Rodada Atual`)
      .setDescription(`A cada 5 minutos uma nova rodada é sorteada!

🕒 Tempo restante: **${minutos}m ${segundos}s**

📜 Regras:
- 🟥 | ⬛ = **2x** o valor apostado
- ⬜ = **15x** o valor apostado
- 🔢 Número exato = **+2x**
- 🔢 Número próximo (±3) = **+1.5x**`)
      .setFooter({ text: "Use !apostar para participar." })
      .setColor("Red");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("📋 Apostas")
        .setCustomId("roleta:apostas")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel("📜 Histórico")
        .setCustomId("roleta:historico")
        .setStyle(ButtonStyle.Secondary)
    );

    await message.reply({ embeds: [embed], components: [row] });
  },

  async button(interaction, { action }) {
    const rodada = await db.get("roleta_rodada") || { apostas: [] };
    const historico = await db.get("roleta_historico") || [];

    if (action === "apostas") {
      const apostas = rodada.apostas || [];

      if (!apostas.length) {
        return interaction.reply({ content: "❌ Nenhuma aposta registrada nesta rodada.", ephemeral: true });
      }

      const listagem = apostas.map((a, i) => 
        `**${i + 1}.** <@${a.userId}> apostou **${a.valor.toLocaleString()}** Berries em ${a.cor || "[sem cor]"}${a.numero != null ? ` + número ${a.numero}` : ""}`
      ).join("\n");

      const embed = new EmbedBuilder()
        .setTitle(`📋 Apostas da Rodada Atual`)
        .setDescription(listagem)
        .setColor("Blue");

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (action === "historico") {
      if (!historico.length) {
        return interaction.reply({ content: "📜 Nenhum resultado anterior registrado ainda.", ephemeral: true });
      }

      const desc = historico.map((h, i) => 
        `**#${i + 1}** Cor: ${h.cor} | Número: ${h.numero} | 💰 Apostas: ${h.totalApostado.toLocaleString()} | 👥 Jogadores: ${h.jogadores}`
      ).join("\n");

      const embed = new EmbedBuilder()
        .setTitle("📜 Histórico das últimas rodadas")
        .setDescription(desc)
        .setColor("Grey");

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};