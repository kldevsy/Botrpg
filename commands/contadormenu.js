const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = {
  name: 'contadormenu',
  description: 'Menu de controle do contador de mensagens',

  async execute(message) {
    const member = message.member;

    // Checa permissão de administrador
    if (!member.permissions.has('Administrator')) {
      return message.reply('❌ Você precisa ser administrador para usar isso.');
    }

    const embed = new EmbedBuilder()
      .setTitle('📊 Sistema de Contador de Mensagens')
      .setDescription(`
Este sistema conta quantas mensagens cada membro envia no servidor, no canal e globalmente!

🔹 **Mensagem por canal**  
🔹 **Mensagem por servidor**  
🔹 **Ranking global**

Use os botões abaixo para controlar o sistema.`)
      .setColor('Blue');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('contador_ativar')
        .setLabel('Ativar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('contador_desativar')
        .setLabel('Desativar')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('contador_resetar')
        .setLabel('Resetar')
        .setStyle(ButtonStyle.Secondary),
    );

    await message.reply({ embeds: [embed], components: [row] });
  },
};
