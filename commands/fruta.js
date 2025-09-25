const { QuickDB } = require('quick.db');
const db = new QuickDB();
const fs = require('fs');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

// Carrega os comandos externos para botões
const upgradeCmd = require('./upfruit.js');
const habilidadesCmd = require('./hfruit.js');

module.exports = {
  name: "fruta",
  aliases: ["minhafruta", "frutaatual"],

  async execute(message) {
    const userId = message.author.id;

    const criado = await db.get(`criado_${userId}`);
    if (!criado) {
      return message.reply("❌ Você ainda não criou seu personagem! Use `!iniciar`.");
    }

    const fruta = await db.get(`fruta_equipada_${userId}`);
    if (!fruta || !fruta.id) {
      return message.reply("🍃 Você não possui nenhuma fruta equipada no momento.");
    }

    const frutaId = fruta.id;
    const nivel = await db.get(`fruta_nivel_${userId}_${frutaId}`) || 1;
    const xp = await db.get(`fruta_xp_${userId}_${frutaId}`) || 0;
    const xpNecessario = 100 + (nivel - 1) * 150;

    // Carregar frutas.json
    let frutasDB;
    try {
      const data = fs.readFileSync('./frutas.json', 'utf8');
      frutasDB = JSON.parse(data).frutas;
    } catch (err) {
      console.error("Erro ao carregar frutas.json:", err);
      return message.reply("Erro ao carregar as informações da fruta.");
    }

    const frutaInfo = frutasDB.find(f => f.nome === fruta.nome);

    const embed = new EmbedBuilder()
      .setTitle("🍇 Sua Fruta Atual")
      .setColor("#e67e22")
      .addFields(
        { name: "Nome", value: fruta.nome, inline: true },
        { name: "Raridade", value: fruta.raridade || "Desconhecida", inline: true },
        { name: "Nível", value: `Lv. ${nivel}`, inline: true },
        { name: "XP", value: `${xp} / ${xpNecessario}`, inline: true }
      )
      .setFooter({ text: "Treine para evoluir sua fruta e desbloquear novas habilidades!" })
      .setTimestamp();

    if (frutaInfo && frutaInfo.imagem) {
      embed.setThumbnail(frutaInfo.imagem);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("fruta:upgrade")
        .setLabel("⬆️ Upgrade")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("fruta:habilidades")
        .setLabel("✨ Habilidades")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("fruta:remover")
        .setLabel("❌ Remover")
        .setStyle(ButtonStyle.Danger)
    );

    return message.channel.send({ embeds: [embed], components: [row] });
  },

  async button(interaction) {
    const [comando, acao] = interaction.customId.split(":");

    if (comando !== "fruta") {
      return interaction.reply({ content: "❌ Botão inválido ou não implementado.", ephemeral: true });
    }

    const userId = interaction.user.id;

    if (acao === "upgrade") {
      return upgradeCmd.run(interaction);
    }

    if (acao === "habilidades") {
      return habilidadesCmd.run(interaction);
    }

    if (acao === "remover") {
      // Perguntar confirmação
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("fruta:remover_confirmar")
          .setLabel("✅ Confirmar")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("fruta:remover_cancelar")
          .setLabel("❌ Cancelar")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        content: "⚠️ Tem certeza que deseja **remover** a fruta equipada? Essa ação não pode ser desfeita.",
        components: [confirmRow],
        ephemeral: true
      });
    }

    if (acao === "remover_confirmar") {
      // Remove a fruta equipada do usuário
      await db.delete(`fruta_equipada_${userId}`);

      return interaction.update({
        content: "✅ Sua fruta equipada foi removida com sucesso.",
        components: [],
        embeds: []
      });
    }

    if (acao === "remover_cancelar") {
      return interaction.update({
        content: "❌ Ação de remoção cancelada.",
        components: [],
        embeds: []
      });
    }

    return interaction.reply({ content: "❌ Ação desconhecida.", ephemeral: true });
  }
};