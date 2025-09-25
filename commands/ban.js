const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField
} = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

function msFromString(input) {
  const match = input.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const [_, value, unit] = match;
  const time = parseInt(value);
  switch (unit) {
    case 's': return time * 1000;
    case 'm': return time * 60 * 1000;
    case 'h': return time * 60 * 60 * 1000;
    case 'd': return time * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

module.exports = {
  name: 'ban',
  description: 'Bane um usuário do servidor com confirmação e duração opcional',
aliases: ['banir'],
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply('❌ Você precisa da permissão **Banir Membros** para usar este comando.');
    }

    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mencione um usuário para banir. Ex: `!ban @usuário motivo tempo`');

    if (!user.bannable || user.id === message.author.id) {
      return message.reply('❌ Não posso banir este usuário.');
    }

    const tempoArg = args[args.length - 1];
    let tempoMs = null;
    let motivo = args.slice(1, args.length - 1).join(' ');

    if (/^\d+[smhd]$/.test(tempoArg)) {
      tempoMs = msFromString(tempoArg);
    } else {
      motivo = args.slice(1).join(' ');
    }

    if (!motivo) motivo = 'Sem motivo fornecido';
    const tempoTexto = tempoMs ? `${tempoArg} (${tempoMs / 1000}s)` : 'Permanente';

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Confirmação de Ban')
      .setDescription(`Você realmente deseja banir **${user.user.tag}**?\nMotivo: \`${motivo}\`\nDuração: \`${tempoTexto}\``)
      .setColor('Red');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ban_confirm_${user.id}`)
        .setLabel('✅ Confirmar')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ban_cancel')
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Secondary)
    );

    const reply = await message.reply({ embeds: [embed], components: [row] });

    const collector = reply.createMessageComponentCollector({ time: 15000 });

    collector.on('collect', async interaction => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({ content: '❌ Apenas quem usou o comando pode confirmar.', ephemeral: true });
      }

      if (interaction.customId === `ban_confirm_${user.id}`) {
        try {
          await user.send(`Você foi banido de **${message.guild.name}**.\nMotivo: ${motivo}\nDuração: ${tempoTexto}`);
        } catch (e) {
          console.log('Não foi possível enviar DM ao usuário.');
        }

        await user.ban({ reason: motivo });
        await interaction.update({
          embeds: [
            new EmbedBuilder()
              .setDescription(`✅ **${user.user.tag}** foi banido.\nMotivo: \`${motivo}\`\nDuração: \`${tempoTexto}\``)
              .setColor('Green')
          ],
          components: []
        });

        if (tempoMs) {
          setTimeout(async () => {
            const bans = await message.guild.bans.fetch();
            if (bans.has(user.id)) {
              await message.guild.members.unban(user.id, 'Ban temporário expirado');
              const logChannelId = await db.get(`config_logs_${message.guild.id}`);
              const logChannel = logChannelId && message.guild.channels.cache.get(logChannelId);
              if (logChannel) {
                logChannel.send(`⏱️ O banimento de **${user.user.tag}** expirou e ele foi desbanido.`);
              }
            }
          }, tempoMs);
        }

      } else if (interaction.customId === 'ban_cancel') {
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
        });
      }
    });
  }
};
