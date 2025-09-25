const {
  PermissionsBitField,
  EmbedBuilder
} = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = {
  name: 'uncastigo',
  description: 'Remove o castigo (timeout) de um membro.',

  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply('❌ Você precisa da permissão **Moderar Membros** para usar este comando.');
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Mencione um usuário. Ex: `!uncastigo @usuário [motivo]`');

    if (!member.communicationDisabledUntilTimestamp) {
      return message.reply('✅ Este membro não está em castigo.');
    }

    const motivo = args.slice(1).join(' ') || 'Sem motivo fornecido';

    try {
      await member.timeout(null, motivo);

      await message.reply(`🔓 Castigo removido de **${member.user.tag}**.`);

      try {
        await member.send(`✅ Você teve o castigo removido no servidor **${message.guild.name}**.\nMotivo: \`${motivo}\``);
      } catch (e) {}

      // Logs
      const logChannelId = await db.get(`config_logs_${message.guild.id}`);
      const logChannel = logChannelId && message.guild.channels.cache.get(logChannelId);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('📒 Castigo Removido')
          .setColor('Green')
          .addFields(
            { name: '👤 Usuário', value: `${member.user.tag} (${member.id})`, inline: true },
            { name: '🛠️ Staff', value: `${message.author.tag}`, inline: true },
            { name: '📄 Motivo', value: motivo }
          )
          .setTimestamp();
        logChannel.send({ embeds: [embed] });
      }

    } catch (err) {
      console.error(err);
      message.reply('❌ Ocorreu um erro ao remover o castigo.');
    }
  }
};
