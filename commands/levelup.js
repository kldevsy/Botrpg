const { QuickDB } = require("quick.db");
const db = new QuickDB();
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

module.exports = {
  name: "levelup",
  aliases: ["subirnivel", "upar"],
  description: "Usa seu XP para subir de nível.",

  async execute(message, args) {
    const userId = message.author.id;

    const xp = await db.get(`xp_${userId}`) || 0;
    const nivel = await db.get(`nivel_${userId}`) || 1;

    const custo = Math.floor(250 * Math.pow(1.3, nivel - 1));
    const progresso = Math.min(((xp / custo) * 100), 100).toFixed(2);

    if (xp < custo) {
      return message.channel.send(`❌ Você precisa de **${custo} XP** para subir para o nível ${nivel + 1}, mas você tem apenas **${xp} XP**.`);
    }

    const embed = new EmbedBuilder()
      .setTitle("🔼 Deseja subir de nível?")
      .setDescription(`Você está prestes a subir de **nível ${nivel} → ${nivel + 1}**.\n\n**XP atual:** ${xp}/${custo} (${progresso}%)`)
      .setColor(0x2b2d31)
      .setFooter({ text: "Confirme abaixo para continuar." });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirmar_up")
        .setLabel("✅ Confirmar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("cancelar_up")
        .setLabel("❌ Cancelar")
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await message.channel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({
      time: 15000,
      filter: (i) => i.user.id === message.author.id,
    });

    collector.on("collect", async (interaction) => {
      await interaction.deferUpdate();

      if (interaction.customId === "confirmar_up") {
        await db.subtract(`xp_${userId}`, custo);
        await db.add(`nivel_${userId}`, 1);

        const novoNivel = nivel + 1;
        await msg.edit({
          embeds: [
            new EmbedBuilder()
              .setTitle("📈 Você subiu de nível!")
              .setDescription(`Parabéns! Agora você está no **nível ${novoNivel}**.\n🔻 XP gasto: **${custo} XP**`)
              .setColor(0x00ff88),
          ],
          components: [],
        });
        collector.stop();
      }

      if (interaction.customId === "cancelar_up") {
        await msg.edit({
          content: "❌ Operação cancelada.",
          embeds: [],
          components: [],
        });
        collector.stop();
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        await msg.edit({
          content: "⌛ Tempo esgotado. Operação cancelada automaticamente.",
          embeds: [],
          components: [],
        });
      }
    });
  }
};