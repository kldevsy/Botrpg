const { EmbedBuilder } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = {
  name: 'count',
  description: 'Veja quantas mensagens você já mandou!',

  async execute(message) {
    const guildId = message.guild.id;
    const channelId = message.channel.id;
    const userId = message.author.id;

    const serverCount = await db.get(`msgcount_${guildId}_${userId}`) || 0;
    const channelCount = await db.get(`msgcount_${guildId}_${channelId}_${userId}`) || 0;
    const globalCount = await db.get(`msgcount_global_${userId}`) || 0;

    const allData = await db.all(); // Retorna [{ id: 'key', value: ... }, ...]

    const allServer = allData.filter(entry =>
      entry.id.startsWith(`msgcount_${guildId}_`) &&
      !entry.id.includes(channelId) &&
      entry.id.split('_').length === 3
    );

    const allChannel = allData.filter(entry =>
      entry.id.startsWith(`msgcount_${guildId}_${channelId}_`)
    );

    const allGlobal = allData.filter(entry =>
      entry.id.startsWith('msgcount_global_')
    );

    const serverRank = allServer
      .sort((a, b) => b.value - a.value)
      .findIndex(entry => entry.id === `msgcount_${guildId}_${userId}`);

    const channelRank = allChannel
      .sort((a, b) => b.value - a.value)
      .findIndex(entry => entry.id === `msgcount_${guildId}_${channelId}_${userId}`);

    const globalRank = allGlobal
      .sort((a, b) => b.value - a.value)
      .findIndex(entry => entry.id === `msgcount_global_${userId}`);

    const embed = new EmbedBuilder()
      .setTitle('📊 Seu contador de mensagens')
      .setColor('Blue')
      .setDescription(`
📨 Você enviou **${serverCount}** mensagens no servidor (Top #${serverRank !== -1 ? serverRank + 1 : 'N/A'})
💬 Você enviou **${channelCount}** mensagens neste canal (Top #${channelRank !== -1 ? channelRank + 1 : 'N/A'})
🌐 Você enviou **${globalCount}** mensagens globalmente (Top #${globalRank !== -1 ? globalRank + 1 : 'N/A'})
      `);

    await message.reply({ embeds: [embed] });
  }
};
