const { QuickDB } = require("quick.db");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const db = new QuickDB();

module.exports = {
  name: "sellacoes",
  description: "Venda ações de suas ilhas para outros jogadores ou publique no mercado",

  async execute(message) {
    const userId = message.author.id;

    const ilhas = await db.get("ilhas_data") || [];

    const minhasIlhas = ilhas.filter(i => i.dono === userId || (i.participacoes && i.participacoes[userId]));

    if (!minhasIlhas.length) {
      return message.reply("❌ Você não possui ações em nenhuma ilha.");
    }

    const embed = new EmbedBuilder()
      .setTitle("📦 Venda de Ações")
      .setDescription("Digite o nome exato da ilha da qual você quer vender ações:")
      .addFields(minhasIlhas.map(i => ({
        name: `${i.nome}`,
        value: `Você possui ${i.participacoes?.[userId] || 0}% de participação.`
      })));

    message.channel.send({ embeds: [embed] });

    const filter = m => m.author.id === userId;
    const collector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

    collector.on("collect", async msg => {
      const nome = msg.content.trim();
      const ilha = minhasIlhas.find(i => i.nome.toLowerCase() === nome.toLowerCase());
      if (!ilha) return msg.reply("❌ Ilha não encontrada.");

      const participacoes = ilha.participacoes || {};
const participacaoAtual = participacoes[userId] || 0;

if (participacaoAtual <= 0) {
  return msg.reply("❌ Você não possui participação suficiente nesta ilha.");
}

      msg.reply(`Você possui **${participacaoAtual}%** da ilha **${ilha.nome}**.\nDigite quantos % deseja vender:`);

      const collector2 = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });
      collector2.on("collect", async msg2 => {
        let porcentagem = parseFloat(msg2.content.replace("%", "").trim());
        if (isNaN(porcentagem) || porcentagem <= 0 || porcentagem > participacaoAtual) {
          return msg2.reply("❌ Porcentagem inválida.");
        }

        if (ilha.dono === userId && participacaoAtual - porcentagem < 30) {
          return msg2.reply("❌ Você precisa manter ao menos 30% da ilha como dono.");
        }

        msg2.reply("🔍 Procurando ofertas...\n💰 Calculando preços...");

        const valorTotal = ilha.valorMercado;
        const base = valorTotal * (porcentagem / 100);

        const ofertas = [
          { tipo: "Preço Justo", multiplicador: 1.05 },
          { tipo: "Desconto Rápido", multiplicador: 0.85 },
          { tipo: "Oferta Premium", multiplicador: 1.25 },
        ];

        const embedOfertas = new EmbedBuilder()
          .setTitle(`💹 Vender ${porcentagem}% de ${ilha.nome}`)
          .setDescription("Escolha uma das opções de preço para a venda:");

        ofertas.forEach((o, i) => {
          const preco = Math.round(base * o.multiplicador);
          embedOfertas.addFields({
            name: `${i + 1}. ${o.tipo}`,
            value: `💰 Valor: **${preco.toLocaleString()} berries**`,
          });
        });

        msg2.channel.send({ embeds: [embedOfertas] });

        const collector3 = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });
        collector3.on("collect", async msg3 => {
          const escolha = parseInt(msg3.content.trim());
          if (![1, 2, 3].includes(escolha)) return msg3.reply("❌ Opção inválida.");

          const oferta = ofertas[escolha - 1];
          const precoFinal = Math.round(base * oferta.multiplicador);

          msg3.reply(`Digite o ID ou mencione o comprador, ou digite **mercado** para publicar:`);

          const collector4 = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });
          collector4.on("collect", async msg4 => {
            const mencao = msg4.mentions.users.first();
            const compradorId = mencao ? mencao.id : msg4.content.trim();

            if (compradorId === "mercado") {
              return msg4.reply(`✅ Oferta de venda publicada no mercado: ${porcentagem}% da ilha **${ilha.nome}** por **${precoFinal.toLocaleString()} berries**.\n*Disponível para qualquer comprador.*`);
            }

            const comprador = await message.guild.members.fetch(compradorId).catch(() => null);
            if (!comprador) return msg4.reply("❌ Usuário não encontrado.");

            const customId = `sellacoes:aceitar:${ilha.nome}:${userId}:${compradorId}:${porcentagem}:${precoFinal}`;
            await db.set(`oferta_temp_${customId}`, {
              compradorId,
              vendedorId: userId,
            });

            const embedVenda = new EmbedBuilder()
              .setTitle(`💼 Oferta de Compra de Ações`)
              .setDescription(`<@${userId}> está te oferecendo **${porcentagem}%** da ilha **${ilha.nome}** por **${precoFinal.toLocaleString()} berries**.`);

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(customId)
                .setLabel("✅ Comprar")
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`sellacoes:recusar`)
                .setLabel("❌ Recusar")
                .setStyle(ButtonStyle.Danger)
            );

            msg4.channel.send({ content: `<@${compradorId}>`, embeds: [embedVenda], components: [row] });
          });
        });
      });
    });
  },

  async button(interaction, { action, rest }) {
    if (action === "aceitar") {
  const [nomeIlha, vendedorId, compradorId, porcentagem, preco] = rest;
  const userId = interaction.user.id;

  const ofertaTemp = await db.get(`oferta_temp_sellacoes:aceitar:${nomeIlha}:${vendedorId}:${compradorId}:${porcentagem}:${preco}`);
  if (!ofertaTemp) {
    return interaction.reply({ content: "❌ Oferta expirada ou inválida.", ephemeral: true });
  }

  if (userId !== ofertaTemp.compradorId) {
    return interaction.reply({ content: "❌ Esta oferta não é destinada a você.", ephemeral: true });
  }

  if (userId === ofertaTemp.vendedorId) {
    return interaction.reply({ content: "❌ Você não pode comprar suas próprias ações.", ephemeral: true });
  }

  const ilhas = await db.get("ilhas_data") || [];
  const index = ilhas.findIndex(i => i.nome === nomeIlha);
  if (index === -1) {
    return interaction.reply({ content: "❌ Ilha não encontrada.", ephemeral: true });
  }

  const ilha = ilhas[index];
  const precoInt = parseInt(preco);
  const porcentagemFloat = parseFloat(porcentagem);

  const saldoComprador = await db.get(`berries_${userId}`) || 0;
  if (saldoComprador < precoInt) {
    return interaction.reply({ content: "❌ Você não tem berries suficientes.", ephemeral: true });
  }

  // Inicializa participações se necessário
  ilha.participacoes = ilha.participacoes || {};
  ilha.participacoes[vendedorId] = ilha.participacoes[vendedorId] || 0;

  // 🔒 Valida se o vendedor tem participação suficiente
  if (ilha.participacoes[vendedorId] < porcentagemFloat) {
    return interaction.reply({ content: "❌ O vendedor não possui participação suficiente.", ephemeral: true });
  }

  // 🛑 Se o vendedor for o dono, ele precisa manter no mínimo 30%
  if (vendedorId === ilha.dono) {
    const novaParticipacao = ilha.participacoes[vendedorId] - porcentagemFloat;
    if (novaParticipacao < 30) {
      return interaction.reply({ content: "❌ O dono da ilha precisa manter pelo menos 30% de participação.", ephemeral: true });
    }
  }

  // 💸 Transação de berries
  await db.set(`berries_${userId}`, saldoComprador - precoInt);
  const saldoVendedor = await db.get(`berries_${vendedorId}`) || 0;
  await db.set(`berries_${vendedorId}`, saldoVendedor + precoInt);

  // 🔄 Transfere participação
  ilha.participacoes[vendedorId] -= porcentagemFloat;
  ilha.participacoes[compradorId] = (ilha.participacoes[compradorId] || 0) + porcentagemFloat;

  if (ilha.participacoes[vendedorId] <= 0) delete ilha.participacoes[vendedorId];

  await db.set("ilhas_data", ilhas);
  await db.delete(`oferta_temp_${interaction.customId}`);

  await interaction.update({
    content: `✅ Transação concluída! Você agora possui **${porcentagemFloat}%** da ilha **${ilha.nome}**.`,
    components: [],
    embeds: [],
  });
    } else if (action === "recusar") {
      await db.delete(`oferta_temp_${interaction.customId}`);
      await interaction.update({ content: "❌ Oferta recusada.", components: [], embeds: [] });
    }
  },
};