const {
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
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
  name: 'castigo',
  description: 'Coloca um membro de castigo (timeout nativo do Discord)',

  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply('❌ Você precisa da permissão **Moderar Membros** para usar este comando.');
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Mencione um usuário. Ex: `!castigo @usuário motivo tempo`');

    if (member.id === message.author.id) return message.reply('❌ Você não pode castigar a si mesmo.');
    if (!member.moderatable) return message.reply('❌ Não posso aplicar castigo neste usuário.');

    const tempoArg = args[args.length - 1];
    const tempoMs = msFromString(tempoArg);
    if (!tempoMs || tempoMs < 5000 || tempoMs > 2419200000) {
      return message.reply('❌ Tempo inválido. Use: `s`, `m`, `h`, `d` (mínimo: 5s, máximo: 28d)');
    }

    const motivo = args.slice(1, args.length - 1).join(' ') || 'Sem motivo fornecido';

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Confirmação de Castigo')
      .setDescription(`Deseja colocar **${member.user.tag}** de castigo?\nMotivo: \`${motivo}\`\nTempo: \`${tempoArg}\``)
      .setColor('Orange');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`castigo_confirm_${member.id}`)
        .setLabel('✅ Confirmar')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('castigo_cancel')
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Secondary)
    );

    const reply = await message.reply({ embeds: [embed], components: [row] });

    const collector = reply.createMessageComponentCollector({ time: 15000 });

    collector.on('collect', async interaction => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({ content: '❌ Apenas quem usou o comando pode confirmar.', ephemeral: true });
      }

      if (interaction.customId === `castigo_confirm_${member.id}`) {
        try {
          await member.timeout(tempoMs, motivo);

          try {
            await member.send(`🚫 Você foi colocado de castigo no servidor **${message.guild.name}**.\nMotivo: \`${motivo}\`\nDuração: \`${tempoArg}\``);
          } catch (e) {}

          await interaction.update({
            embeds: [new EmbedBuilder()
              .setDescription(`⛓️ **${member.user.tag}** foi colocado de castigo por \`${tempoArg}\``)
              .setColor('Red')],
            components: []
          });

          // Enviar para canal de logs
          const logChannelId = await db.get(`config_logs_${message.guild.id}`);
          const logChannel = logChannelId && message.guild.channels.cache.get(logChannelId);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('📒 Castigo Aplicado')
              .setColor('Red')
              .addFields(
                { name: '👤 Usuário', value: `${member.user.tag} (${member.id})`, inline: true },
                { name: '🛠️ Staff', value: `${message.author.tag}`, inline: true },
                { name: '⏱️ Duração', value: tempoArg, inline: true },
                { name: '📄 Motivo', value: motivo }
              )
              .setTimestamp();
            logChannel.send({ embeds: [logEmbed] });
          }

        } catch (err) {
          console.error(err);
          await interaction.update({
            embeds: [new EmbedBuilder().setDescription('❌ Ocorreu um erro ao aplicar o castigo.').setColor('Red')],
            components: []
          });
        }
      }

      if (interaction.customId === 'castigo_cancel') {
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
          embeds: [new EmbedBuilder()
            .setDescription('⏰ Tempo esgotado. Ação cancelada.')
            .setColor('Grey')],
          components: []
        });
      }
    });
  }
};
