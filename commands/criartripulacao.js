const { QuickDB } = require("quick.db");
const { EmbedBuilder } = require("discord.js");
const db = new QuickDB();

module.exports = {
  name: "criartripulacao",
  description: "Cria uma nova tripulação pirata.",
  aliases: ["criartime", "newcrew"],
  async execute(message, args) {
    const userId = message.author.id;
    const nome = args.join(" ");

    if (!nome || nome.length < 3 || nome.length > 20) {
      const embedErro = new EmbedBuilder()
        .setColor("Red")
        .setTitle("❌ Nome inválido!")
        .setDescription("Use: `!criartripulacao [nome da tripulação]`\n> O nome deve ter entre **3 e 20 caracteres**.")
        .setFooter({ text: "Sistema de Tripulações - One Piece RPG" })
        .setTimestamp();
      return message.reply({ embeds: [embedErro] });
    }

    const jaTem = await db.get(`tripulacao_usuario_${userId}`);
    if (jaTem) {
      return message.reply("❌ Você já pertence a uma tripulação. Saia dela antes de criar outra.");
    }

    const jaExiste = await db.get(`tripulacoes.${nome}`);
    if (jaExiste) {
      return message.reply("❌ Já existe uma tripulação com esse nome. Tente outro.");
    }

    // Criar tripulação
    const novaTrip = {
      nome,
      capitao: userId,
      brasao: null,
      descricao: "Sem descrição no momento.",
      membros: [userId],
      cargos: {
        [userId]: "Capitão"
      },
      xp: 0,
      nivel: 1,
      reputacao: 0,
      ouro: 0,
      vitorias: 0,
      derrotas: 0,
      logCriacao: Date.now(),
      sede: {
        nivel: 1,
        buffs: {},
        construcoes: []
      },
      conquistas: []
    };

    await db.set(`tripulacoes.${nome}`, novaTrip);
    await db.set(`tripulacao_usuario_${userId}`, nome);

    const embed = new EmbedBuilder()
      .setColor("Gold")
      .setTitle("🏴‍☠️ Tripulação Criada!")
      .setDescription(`Parabéns <@${userId}>! Você fundou a tripulação **${nome}**!`)
      .addFields(
        { name: "📜 Capitão", value: `<@${userId}>`, inline: true },
        { name: "🎖️ Nível Inicial", value: "1", inline: true },
        { name: "⚓ Descrição", value: novaTrip.descricao }
      )
      .setFooter({ text: "Tripulações - One Piece RPG" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};