const { QuickDB } = require('quick.db');
const { EmbedBuilder } = require('discord.js');
const db = new QuickDB();

module.exports = {
  name: 'iniciar',
  description: 'Cria seu personagem e escolhe sua facção (pirata ou marinha)',
  aliases: ['start', 'comecar'],

  async execute(message, args) {
    const userId = message.author.id;
    const nome = message.author.username;

    const criado = await db.get(`criado_${userId}`);
    if (criado) {
      return message.reply("❌ Você já criou seu personagem! Use `!perfil` para ver.");
    }

    const faccao = args[0]?.toLowerCase();
    if (!faccao || (faccao !== "pirata" && faccao !== "marinha")) {
      return message.reply("❌ Escolha uma facção: `!iniciar pirata` ou `!iniciar marinha`.");
    }

    // Dados iniciais
    const nivel = 1;
    const xp = 0;
    const berries = 500;
    const bounty = faccao === "pirata" ? 1000 : 0;
    const rank = "Iniciante";

    // Status
    const forca = 5;
    const defesa = 5;
    const agilidade = 5;
    const inteligencia = 5;
    const estamina = 10;

    // Salvando dados
    await db.set(`criado_${userId}`, true);
    await db.set(`nome_${userId}`, nome);
    await db.set(`faccao_${userId}`, faccao);
    await db.set(`nivel_${userId}`, nivel);
    await db.set(`xp_${userId}`, xp);
    await db.set(`berries_${userId}`, berries);
    await db.set(`bounty_${userId}`, bounty);
    await db.set(`rank_${userId}`, rank);

    await db.set(`status_forca_${userId}`, forca);
    await db.set(`status_defesa_${userId}`, defesa);
    await db.set(`status_agilidade_${userId}`, agilidade);
    await db.set(`status_inteligencia_${userId}`, inteligencia);
    await db.set(`status_estamina_${userId}`, estamina);

    await db.set(`inventario_${userId}`, []);
    await db.set(`frutas_${userId}`, []);
    await db.set(`equipamentos_${userId}`, {});
  
    await db.set(`tripulacao_${userId}`, null);
await db.set(`trabalhos_${userId}`, []);
    await db.set(`criadoEm_${userId}`, Date.now());

    // Embed de boas-vindas
    const embed = new EmbedBuilder()
      .setTitle("🏴‍☠️ Aventura Começou!")
      .setColor(faccao === "pirata" ? 0xff4b4b : 0x4b6bff)
      .setDescription(`Bem-vindo ao mundo de One Piece, **${nome}**!`)
      .addFields(
        { name: "⚔️ Facção", value: faccao.charAt(0).toUpperCase() + faccao.slice(1), inline: true },
        { name: "📊 Rank Inicial", value: rank, inline: true },
        { name: "💰 Berries", value: berries.toString(), inline: true }
      )
      .setFooter({ text: "Use !perfil para ver seu progresso." })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }
};
