const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField
} = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = {
  name: 'kick',
  description: 'Expulsa um usuário do servidor com confirmação',

  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply('❌ Você precisa da permissão **Expulsar Membros** para usar este comando.');
    }

    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mencione um usuário para expulsar. Ex: `!kick @usuário motivo`');

    if (!user.kickable || user.id === message.author.id) {
      return message.reply('❌ Não posso expulsar este usuário.');
    }

    const reason = args.slice(1).join(' ') || 'Sem motivo fornecido';

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Confirmação de Kick')
      .setDescription(`Você realmente deseja expulsar **${user.user.tag}**?\nMotivo: \`${reason}\``)
      .setColor('Orange');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`kick_confirm_${user.id}`)
        .setLabel('✅ Confirmar')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('kick_cancel')
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Secondary)
    );

    const reply = await message.reply({ embeds: [embed], components: [row] });

    const collector = reply.createMessageComponentCollector({ time: 15000 });

    collector.on('collect', async interaction => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({ content: '❌ Apenas quem usou o comando pode confirmar.', ephemeral: true });
      }

      if (interaction.customId === `kick_confirm_${user.id}`) {
        await user.kick(reason);

        const confirmEmbed = new EmbedBuilder()
          .setDescription(`✅ **${user.user.tag}** foi expulso.\nMotivo: \`${reason}\``)
          .setColor('Green');

        await interaction.update({ embeds: [confirmEmbed], components: [] });

        // Enviar para o canal de logs se configurado
        const logChannelId = await db.get(`config_logs_${message.guild.id}`);
        if (logChannelId) {
          const logChannel = message.guild.channels.cache.get(logChannelId);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🚨 Log de Expulsão')
              .addFields(
                { name: '👤 Usuário Expulso', value: `${user.user.tag} (${user.id})` },
                { name: '🛡️ Staff Responsável', value: `${message.author.tag} (${message.author.id})` },
                { name: '📄 Motivo', value: reason }
              )
              .setColor('Red')
              .setTimestamp();

            logChannel.send({ embeds: [logEmbed] }).catch(console.error);
          }
        }
      } else if (interaction.customId === 'kick_cancel') {
        await interaction.update({
          embeds: [new EmbedBuilder().setDescription('❌ Ação cancelada.').setColor('Red')],
          components: []
        });
      }

      collector.stop();
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        reply.edit({
          embeds: [new EmbedBuilder().setDescription('⏰ Tempo esgotado. Ação cancelada.').setColor('Grey')],
          components: []
        }).catch(() => {});
      }
    });
  }
};
