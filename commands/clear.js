const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = {
  name: 'clear',
  description: 'Limpa mensagens no canal (suporta filtro por usuário)',

  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply('❌ Você precisa da permissão **Gerenciar Mensagens** para usar este comando.');
    }

    const amount = parseInt(args[0], 10);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply('❌ Forneça um número entre 1 e 100 de mensagens para deletar.');
    }

    const users = message.mentions.users;
    const hasFilter = users.size > 0;

    await message.delete(); // Deleta o comando enviado

    const messages = await message.channel.messages.fetch({ limit: 100 });

    const toDelete = hasFilter
      ? messages.filter(m => users.has(m.author.id)).first(amount)
      : messages.filter(m => m.id !== message.id).first(amount);

    if (toDelete.length === 0) {
      return message.channel.send('❌ Não encontrei mensagens para deletar.').then(msg => {
        setTimeout(() => msg.delete(), 5000);
      });
    }

    await message.channel.bulkDelete(toDelete, true);

    const confirm = await message.channel.send(`🧹 ${toDelete.length} mensagem(ns) ${hasFilter ? 'dos usuários mencionados ' : ''}foram deletadas!`);
    setTimeout(() => confirm.delete(), 5000);

    // Envio de log
    const logChannelId = await db.get(`config_logs_${message.guild.id}`);
    if (logChannelId) {
      const logChannel = message.guild.channels.cache.get(logChannelId);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🧹 Log de Limpeza de Mensagens')
          .addFields(
            { name: '👮 Ação por', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: '💬 Canal', value: `<#${message.channel.id}>`, inline: true },
            { name: '🔢 Quantidade', value: `${toDelete.length}`, inline: true },
            ...(hasFilter ? [
              { name: '👥 Usuários filtrados', value: users.map(u => `${u.tag}`).join(', ') }
            ] : [])
          )
          .setColor('Blue')
          .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(console.error);
      }
    }
  }
};
