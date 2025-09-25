const { PermissionsBitField, EmbedBuilder, ChannelType } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = {
  name: 'unlock',
  description: 'Desbloqueia o canal atual ou um canal mencionado (permite envio de mensagens)',

  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply('❌ Você precisa da permissão **Gerenciar Canais** para usar este comando.');
    }

    const canal = message.mentions.channels.first() || message.channel;
    const everyone = message.guild.roles.everyone;

    if (canal.type !== ChannelType.GuildText) {
      return message.reply('❌ Este comando só funciona em canais de texto.');
    }

    try {
      await canal.permissionOverwrites.edit(everyone, { SendMessages: null });
      await message.reply(`🔓 O canal ${canal} foi desbloqueado.`);

      const logChannelId = await db.get(`config_logs_${message.guild.id}`);
      const logChannel = logChannelId && message.guild.channels.cache.get(logChannelId);

      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🔓 Canal Desbloqueado')
          .setColor('Green')
          .addFields(
            { name: '📢 Canal', value: `${canal}` },
            { name: '👮 Staff', value: `${message.author.tag}` }
          )
          .setTimestamp();
        logChannel.send({ embeds: [embed] });
      }

    } catch (err) {
      console.error(err);
      message.reply('❌ Ocorreu um erro ao tentar desbloquear o canal.');
    }
  }
};
