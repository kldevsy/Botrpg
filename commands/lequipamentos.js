const { QuickDB } = require('quick.db');
const db = new QuickDB();
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const equipamentosData = require('../equipamentos.json');

module.exports = {
  name: 'lequipamentos',
  aliases: ['lequip', 'lojaequip'],
  description: 'Mostra a loja de equipamentos.',

  async execute(message) {
    const userId = message.author.id;
    const criado = await db.get(`criado_${userId}`);
    if (!criado) return message.reply("❌ Você ainda não criou seu personagem! Use `!iniciar`.");

    const loja = equipamentosData.equipamentos.filter(e => e.loja);
    if (!loja.length) return message.reply("Nenhum equipamento está à venda no momento.");

    await this.mostrarPagina(message.channel, 0, loja);
  },

  async button(interaction, { action, rest }) {
    const userId = interaction.user.id;
    const loja = equipamentosData.equipamentos.filter(e => e.loja);
    if (!loja.length) return interaction.reply({ content: "❌ Nenhum item disponível.", ephemeral: true });

    if (action === "pagina") {
      const pagina = parseInt(rest[0]) || 0;
      return this.mostrarPagina(interaction, pagina, loja, true);
    }

    if (action === "comprar") {
      await interaction.reply({ content: "Digite o ID do item que deseja comprar:", ephemeral: true });

      const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === userId,
        time: 30000,
        max: 1
      });

      collector.on("collect", async msg => {
        const itemId = msg.content.trim();
        const item = loja.find(e => e.id === itemId);
        if (!item) return msg.reply("❌ ID inválido ou item fora da loja.");

        const saldo = await db.get(`berries_${userId}`) || 0;
        if (saldo < item.preco) return msg.reply("❌ Você não tem berries suficientes.");

        const equipamentosUser = await db.get(`equipamentos_${userId}`) || [];
        if (equipamentosUser.includes(item.id)) return msg.reply("❌ Você já possui esse equipamento.");

        await db.set(`berries_${userId}`, saldo - item.preco);
        equipamentosUser.push(item.id);
        await db.set(`equipamentos_${userId}`, equipamentosUser);

        msg.reply(`✅ Você comprou **${item.nome}** com sucesso!`);
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          interaction.followUp({ content: "⏰ Tempo esgotado para digitar o ID.", ephemeral: true });
        }
      });
    }
  },

  async mostrarPagina(contexto, pagina, loja, isInteraction = false) {
    const porPagina = 5;
    const totalPaginas = Math.ceil(loja.length / porPagina);
    const inicio = pagina * porPagina;
    const itensPagina = loja.slice(inicio, inicio + porPagina);

    const embed = new EmbedBuilder()
      .setTitle('🏪 Loja de Equipamentos')
      .setColor('#2ecc71')
      .setFooter({ text: `Página ${pagina + 1}/${totalPaginas}` });

    for (const item of itensPagina) {
      const bonus = Object.entries(item.bonus || {})
        .map(([stat, val]) => `+${val} ${stat}`).join(", ") || "Nenhum bônus";
      embed.addFields({
        name: `🛡️ ${item.nome} (${item.raridade.toUpperCase()}) - ${item.preco} berries`,
        value: `ID: \`${item.id}\`\n${item.descricao}\n**Bônus:** ${bonus}`,
      });
    }

    const botoes = new ActionRowBuilder();

    if (pagina > 0) {
      botoes.addComponents(
        new ButtonBuilder()
          .setCustomId(`lequipamentos:pagina:${pagina - 1}`)
          .setLabel('⬅️ Voltar')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    botoes.addComponents(
      new ButtonBuilder()
        .setCustomId(`lequipamentos:comprar`)
        .setLabel('🛒 Comprar Equipamento')
        .setStyle(ButtonStyle.Success)
    );

    if (pagina < totalPaginas - 1) {
      botoes.addComponents(
        new ButtonBuilder()
          .setCustomId(`lequipamentos:pagina:${pagina + 1}`)
          .setLabel('➡️ Próxima')
          .setStyle(ButtonStyle.Secondary)
      );
    }


    const payload = { embeds: [embed], components: [botoes] };
    if (isInteraction) return contexto.update(payload);
    else return contexto.send(payload);
  }
};