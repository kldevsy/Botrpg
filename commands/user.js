const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require('discord.js');

module.exports = {
  name: 'user',
  description: 'Exibe o perfil estilizado com banner e botões',

  async execute(message) {
    const mention = message.mentions.members.first();
    const member = mention || message.member;
    const user = member.user;

    const isSelf = message.author.id === user.id;
    const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);

    const entrouEm = `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`;
    const criadoEm = `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`;

    const fetchedUser = await message.client.users.fetch(user.id, { force: true });
    const bannerUrl = fetchedUser.bannerURL({ dynamic: true, size: 1024 });

    const embed = new EmbedBuilder()
      .setColor('#ff0040')
      .setTitle(`📇 Perfil de ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        {
          name: '🗂️ Informações',
          value: `🏷️ **Tag:** ${user.tag}\n🆔 **ID:** ${user.id}`
        },
        {
          name: '📅 Datas',
          value: `🗓️ Entrou: ${entrouEm}\n📆 Criou: ${criadoEm}`
        },
        {
          name: '📊 Estatísticas',
          value: `📨 Mensagens: **4877**\n💰 Moedas: **721**\n🏆 Conquistas: **8**\n🛒 Compras: **85**`
        },
        {
          name: '📌 Cargos',
          value:
            member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.toString()).join(', ') || 'Nenhum'
        }
      );

    if (bannerUrl) embed.setImage(bannerUrl);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('castigo')
        .setLabel('Castigar')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!isAdmin || isSelf),

      new ButtonBuilder()
        .setCustomId('expulsar')
        .setLabel('Expulsar')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!isAdmin || isSelf),

      new ButtonBuilder()
        .setCustomId('banir')
        .setLabel('Banir')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!isAdmin || isSelf),

      new ButtonBuilder()
        .setCustomId('aceitar')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!isAdmin || isSelf)
    );

    await message.reply({
      embeds: [embed],
      components: [row]
    });
  }
};
