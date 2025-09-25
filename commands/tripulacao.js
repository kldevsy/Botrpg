const { QuickDB } = require("quick.db");
const { EmbedBuilder } = require("discord.js");
const db = new QuickDB();

module.exports = {
  name: "tripulacao",
  description: "Mostra as informações da sua tripulação.",
  aliases: ["crew", "minhatrip", "tripinfo"],
  async execute(message, args) {
    const userId = message.author.id;
    const tripName = await db.get(`tripulacao_usuario_${userId}`);

    if (!tripName) {
      return message.reply("❌ Você não pertence a nenhuma tripulação.");
    }

    const tripulacao = await db.get(`tripulacoes.${tripName}`);
    if (!tripulacao) {
      await db.delete(`tripulacao_usuario_${userId}`);
      return message.reply("❌ Sua tripulação não foi encontrada. Ela pode ter sido deletada.");
    }

    const capitaoTag = `<@${tripulacao.capitao}>`;
    const totalMembros = tripulacao.membros?.length || 1;
    const brasao = tripulacao.brasao || "Nenhum definido.";
    const descricao = tripulacao.descricao || "Sem descrição.";

    const embed = new EmbedBuilder()
      .setColor("Purple")
      .setTitle(`🏴‍☠️ Tripulação: ${tripulacao.nome}`)
      .setThumbnail(brasao !== "Nenhum definido." ? brasao : null)
      .setDescription(`**Descrição:** ${descricao}`)
      .addFields(
        { name: "👑 Capitão", value: capitaoTag, inline: true },
        { name: "🧑‍🤝‍🧑 Membros", value: `${totalMembros}`, inline: true },
        { name: "🎖️ Nível", value: `${tripulacao.nivel} (${tripulacao.xp} XP)`, inline: true },
        { name: "🏆 Reputação", value: `${tripulacao.reputacao}`, inline: true },
        { name: "💰 Ouro", value: `${tripulacao.ouro.toLocaleString()}`, inline: true },
        { name: "📈 Vitórias / Derrotas", value: `${tripulacao.vitorias} / ${tripulacao.derrotas}`, inline: true },
        { name: "🏡 Sede", value: `Nível ${tripulacao.sede?.nivel || 1}`, inline: true },
        { name: "📅 Criada em", value: `<t:${Math.floor(tripulacao.logCriacao / 1000)}:f>`, inline: true }
      )
      .setFooter({ text: "Sistema de Tripulações - One Piece RPG" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};