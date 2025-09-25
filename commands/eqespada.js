const { QuickDB } = require("quick.db");
const db = new QuickDB();

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const espadasJson = require("../espadas.json");

module.exports = {
  name: "eqespada",
  aliases: ["equipespada"],
  description: "Equipe uma espada do seu inventário.",

  async execute(message, args) {
    const userId = message.author.id;

    const criado = await db.get(`criado_${userId}`);
    if (!criado) {
      return message.reply("❌ Você ainda não criou seu personagem! Use `!iniciar`.");
    }

    const input = args.join(" ").toLowerCase();
    if (!input) return message.reply("Digite o **ID ou nome da espada** que deseja equipar.");

    const espadasDoJogador = await db.get(`espadas_${userId}`) || [];

    const espadaPossuida = espadasDoJogador.find(e => {
      const id = typeof e === "string" ? e.toLowerCase() : (e.id || "").toLowerCase();
      const nome = typeof e === "object" ? (e.nome || "").toLowerCase() : "";
      return id === input || nome === input || nome.includes(input);
    });

    if (!espadaPossuida) {
      return message.reply("❌ Você não possui essa espada.");
    }

    const idFinal = typeof espadaPossuida === "string" ? espadaPossuida : espadaPossuida.id;
    const espadaInfo = espadasJson.espadas.find(e => e.id.toLowerCase() === idFinal.toLowerCase());

    if (!espadaInfo) return message.reply("❌ Informações da espada não encontradas.");

    const espadaAtualId = await db.get(`espada_${userId}`);
    const espadaAtualInfo = espadasJson.espadas.find(e => e.id === espadaAtualId);

    if (espadaAtualId === espadaInfo.id) {
      return message.reply(`⚔️ Você já está com a espada **${espadaInfo.nome}** equipada.`);
    }

    if (espadaAtualId && espadaAtualId !== espadaInfo.id) {
      const embed = new EmbedBuilder()
        .setTitle("Confirmação de Troca de Espada")
        .setDescription(`Você já está com a espada **${espadaAtualInfo?.nome || "desconhecida"}** equipada.`)
        .addFields({ name: "Nova espada", value: `**${espadaInfo.nome}**` })
        .setFooter({ text: "Deseja trocar de espada?" })
        .setColor("#3498db");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`eqespada:confirmar:${espadaInfo.id}`)
          .setLabel("✅ Sim, trocar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`eqespada:cancelar`)
          .setLabel("❌ Cancelar")
          .setStyle(ButtonStyle.Danger)
      );

      return message.reply({ embeds: [embed], components: [row] });
    } else {
      await db.set(`espada_${userId}`, espadaInfo.id);
      return message.reply(`✅ **${espadaInfo.nome}** foi equipada com sucesso!`);
    }
  },

  async button(interaction) {
    const userId = interaction.user.id;
    const [cmd, acao, id] = interaction.customId.split(":");

    if (cmd !== "eqespada") return;

    if (acao === "cancelar") {
      return interaction.update({
        content: "❌ Troca de espada cancelada.",
        embeds: [],
        components: []
      });
    }

    if (acao === "confirmar") {
      const espadaInfo = espadasJson.espadas.find(e => e.id === id);
      if (!espadaInfo) {
        return interaction.update({
          content: "❌ Espada não encontrada.",
          embeds: [],
          components: []
        });
      }

      await db.set(`espada_${userId}`, espadaInfo.id);

      return interaction.update({
        content: `✅ **${espadaInfo.nome}** foi equipada com sucesso!`,
        embeds: [],
        components: []
      });
    }
  }
};