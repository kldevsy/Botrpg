const { PermissionsBitField, EmbedBuilder, ChannelType } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

function parseTempo(input) {
  const match = input.match(/^(\d+)([smhd])?$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unidade = match[2] || 's';

  switch (unidade) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return null;
  }
}

module.exports = {
  name: 'slowmode',
  description: 'Define o tempo de modo lento (slowmode) para um canal (suporta s, m, h, d)',

  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply('❌ Você precisa da permissão **Gerenciar Canais** para usar este comando.');
    }

    if (!args[0]) return message.reply('❌ Forneça um tempo válido. Ex: `!slowmode 10s` ou `!slowmode 5m`');

    const tempoEmSegundos = parseTempo(args[0]);
    if (tempoEmSegundos === null || tempoEmSegundos < 0 || tempoEmSegundos > 21600) {
      return message.reply('❌ Forneça um tempo entre 0 e 6 horas. Ex: `!slowmode 10s`, `5m`, `2h`, etc.');
    }

    const canal = message.mentions.channels.first() || message.channel;

    if (canal.type !== ChannelType.GuildText) {
      return message.reply('❌ Este comando só pode ser usado em canais de texto.');
    }

    try {
      await canal.setRateLimitPerUser(tempoEmSegundos);
      await message.reply(`🕐 O modo lento no canal ${canal} foi definido para \`${tempoEmSegundos}\` segundo(s).`);

      const logChannelId = await db.get(`config_logs_${message.guild.id}`);
      const logChannel = logChannelId && message.guild.channels.cache.get(logChannelId);

      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🕐 Modo Lento Atualizado')
          .setColor('Blue')
          .addFields(
            { name: '📢 Canal', value: `${canal}` },
            { name: '⏱️ Tempo', value: `${tempoEmSegundos} segundo(s)` },
            { name: '👮 Staff', value: `${message.author.tag}` }
          )
          .setTimestamp();

        logChannel.send({ embeds: [embed] });
      }

    } catch (err) {
      console.error(err);
      message.reply('❌ Ocorreu um erro ao definir o modo lento no canal.');
    }
  }
};
