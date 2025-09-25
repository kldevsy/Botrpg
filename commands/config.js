const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  Events
} = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = {
  name: 'config',
  description: 'Configure canais de logs e outras funções do bot.',

  async execute(message, client) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ Apenas administradores podem usar este comando.');
    }

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configuração do Bot')
      .setDescription('Utilize os botões abaixo para configurar canais do sistema.')
      .addFields([
        {
          name: '🛠️ Canal de Logs',
          value: 'Define onde serão enviados os logs de moderação (ban, kick, clear, etc.).'
        }
      ])
      .setColor('Blue');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('set_logs_channel')
        .setLabel('🛠️ Definir Canal de Logs')
        .setStyle(ButtonStyle.Primary)
    );

    const reply = await message.reply({ embeds: [embed], components: [row] });

    const collector = reply.createMessageComponentCollector({
      time: 60000,
      filter: i => i.user.id === message.author.id
    });

    collector.on('collect', async interaction => {
      if (interaction.customId === 'set_logs_channel') {
        await db.set(`config_logs_${message.guild.id}`, message.channel.id);

        await interaction.reply({
          content: `✅ Canal de logs configurado com sucesso para: ${message.channel}`,
          ephemeral: true
        });
      }
    });

    collector.on('end', () => {
      reply.edit({ components: [] }).catch(() => {});
    });
  }
};
