const { QuickDB } = require('quick.db');
const { EmbedBuilder } = require('discord.js');
const db = new QuickDB();

module.exports = {
  name: 'perfil',
  description: 'Mostra o perfil do seu personagem',
  aliases: ['profile'],

  async execute(message) {
    const userId = message.author.id;

    const criado = await db.get(`criado_${userId}`);
    if (!criado) {
      return message.reply("❌ Você ainda não criou seu personagem! Use `!iniciar`.");
    }

    const formatar = (num) => Number(num || 0).toLocaleString("en-US");

    // Dados principais
    const nome = await db.get(`nome_${userId}`) || "Desconhecido";
    const faccao = await db.get(`faccao_${userId}`) || "N/A";
    const nivel = await db.get(`nivel_${userId}`) || 1;
    const xp = await db.get(`xp_${userId}`) || 0;
    const berries = await db.get(`berries_${userId}`) || 0;
    const bounty = await db.get(`bounty_${userId}`) || 0;
    const rank = await db.get(`rank_${userId}`) || "Iniciante";
await db.set(`comum_${userId}`, 2);
    await db.set(`raro_${userId}`, 2);
    // Atributos
    const forca = await db.get(`status_forca_${userId}`) || 0;
    const defesa = await db.get(`status_defesa_${userId}`) || 0;
    const agilidade = await db.get(`status_agilidade_${userId}`) || 0;
    const inteligencia = await db.get(`status_inteligencia_${userId}`) || 0;
    const estamina = await db.get(`status_estamina_${userId}`) || 0;
await db.set(`berries_${userId}`, 5000000)
    const embed = new EmbedBuilder()
      .setColor(faccao.toLowerCase() === "pirata" ? 0xff4b4b : 0x4b6bff)
      .setTitle(`📜 Perfil de ${nome}`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "🏴 Facção", value: faccao.charAt(0).toUpperCase() + faccao.slice(1), inline: true },
        { name: "🎖️ Rank", value: rank, inline: true },
        { name: "🧬 Nível", value: nivel.toString(), inline: true },
        { name: "📘 XP", value: formatar(xp), inline: true },
        { name: "💰 Berries", value: `💵 ${formatar(berries)}`, inline: true },
        { name: "🏴‍☠️ Bounty", value: `💀 ${formatar(bounty)}`, inline: true },
        { name: "💪 Força", value: forca.toString(), inline: true },
        { name: "🛡️ Defesa", value: defesa.toString(), inline: true },
        { name: "🤸 Agilidade", value: agilidade.toString(), inline: true },
        { name: "🧠 Inteligência", value: inteligencia.toString(), inline: true },
        { name: "🔥 Estamina", value: estamina.toString(), inline: true }
      )
      .setFooter({ text: "⚙️ Use !iniciar para criar/modificar seu personagem." })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }
};
