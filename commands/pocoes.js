const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const loja = require("../loja.json");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = {
  name: "pocoes", // <- sem acento!
  aliases: ["poções", "potions"],
  description: "Abre o menu de poções por categoria.",

  async execute(message) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pocoes:categoria:cura")
        .setLabel("Cura")
        .setEmoji("🧪")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pocoes:categoria:stamina")
        .setLabel("Stamina")
        .setEmoji("⚡")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pocoes:buffmenu")
        .setLabel("Buffs")
        .setEmoji("📈")
        .setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setColor("#3399ff")
      .setTitle("💼 Inventário de Poções")
      .setDescription("Selecione a categoria para ver suas poções:");

    await message.reply({ embeds: [embed], components: [row] });
  },

  async button(interaction, { action, rest }) {
    const userId = interaction.user.id;

    if (action === "buffmenu") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pocoes:categoria:buffxp")
          .setLabel("XP")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("pocoes:categoria:buffxpfruta")
          .setLabel("XP Fruta")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("pocoes:categoria:buffberries")
          .setLabel("Berries")
          .setStyle(ButtonStyle.Primary)
      );

      const embed = new EmbedBuilder()
        .setColor("#ffd700")
        .setTitle("📈 Buffs Temporários")
        .setDescription("Escolha o tipo de buff para visualizar:");

      return interaction.update({ embeds: [embed], components: [row] });
    }

    if (action === "categoria") {
      const categoria = rest[0];
      const itens = loja[categoria];

      if (!Array.isArray(itens)) {
        return interaction.reply({ content: "❌ Categoria inválida ou sem itens.", ephemeral: true });
      }

      const inventario = await Promise.all(itens.map(async item => {
        const quantidade = await db.get(`${item.id}_${userId}`) || 0;
        return quantidade > 0 ? `**${item.nome}**: ${quantidade}x` : null;
      }));

      const filtrado = inventario.filter(Boolean);

      if (filtrado.length === 0) {
        return interaction.update({
          embeds: [new EmbedBuilder()
            .setColor("#ff4444")
            .setDescription("📦 Você não possui poções dessa categoria.")],
          components: []
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#3399ff")
        .setTitle(`💼 Inventário de Poções: ${categoria.toUpperCase()}`)
        .setDescription(filtrado.join("\n"));

      return interaction.update({ embeds: [embed], components: [] });
    }
  }
};