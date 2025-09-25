const { QuickDB } = require("quick.db");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = new QuickDB();

module.exports = {
  name: "venderilha",
  description: "Venda uma ilha sua de volta para o sistema.",

  async execute(message) {
    const userId = message.author.id;
    const ilhas = await db.get("ilhas_data") || [];
    const minhasIlhas = ilhas.filter(i => i.dono === userId);

    if (!minhasIlhas.length) {
      return message.reply("❌ Você não possui ilhas para vender.");
    }

    const embed = new EmbedBuilder()
      .setTitle("🏝️ Venda de Ilha")
      .setDescription("Digite o nome exato da ilha que deseja vender:")
      .addFields(minhasIlhas.map(i => ({
        name: i.nome,
        value: `💰 Valor de mercado: ${i.valorMercado.toLocaleString()} berries\n📈 Lucro: ${i.lucroPercentual}%\n📊 Popularidade: ${i.popularidade}\n🎯 Participações: ${Object.keys(i.participacoes || {}).length}`
      })))
      .setColor("Yellow");

    await message.channel.send({ embeds: [embed] });

    const filter = m => m.author.id === userId;
    const collector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

    collector.on("collect", async msg => {
      const nome = msg.content.trim();
      const ilha = minhasIlhas.find(i => i.nome.toLowerCase() === nome.toLowerCase());
      if (!ilha) return msg.reply("❌ Ilha não encontrada.");

      const gerarEmbedVenda = () => {
        const participacoes = ilha.participacoes || {};
        const totalPercentual = Object.values(participacoes).reduce((a, b) => a + b, 0);
        const percentualDono = participacoes[userId] || 0;

        // 💡 IA simples de avaliação
        const bonus = ilha.popularidade * 0.015 + ilha.lucroPercentual * 0.01;
        const fatorMercado = 1.1 + bonus;
        const valorEstimado = Math.round(ilha.valorMercado * fatorMercado);

        const distribuicoes = [];
        for (const [id, porcento] of Object.entries(participacoes)) {
          const valor = Math.round((porcento / 100) * valorEstimado);
          distribuicoes.push({ id, porcento, valor });
        }

        const embedResultado = new EmbedBuilder()
          .setTitle(`📜 Avaliação da Ilha: ${ilha.nome}`)
          .setDescription(`💰 Valor estimado da venda: **${valorEstimado.toLocaleString()} berries**`)
          .setColor("Gold")
          .addFields([
            { name: "🏦 Lucro do Dono", value: `${Math.round((percentualDono / 100) * valorEstimado).toLocaleString()} berries (${percentualDono}%)`, inline: true },
            { name: "👥 Participações", value: distribuicoes.filter(d => d.id !== userId).map(d => `<@${d.id}> recebe **${d.valor.toLocaleString()} berries** (${d.porcento}%)`).join("\n") || "Nenhuma", inline: false }
          ]);

        return { embedResultado, distribuicoes, valorEstimado };
      };

      const { embedResultado, distribuicoes, valorEstimado } = gerarEmbedVenda();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`venderilha:confirmar:${ilha.nome}`)
          .setLabel("✅ Vender")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`venderilha:recalcular:${ilha.nome}`)
          .setLabel("🔄 Recalcular")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`venderilha:cancelar`)
          .setLabel("❌ Cancelar")
          .setStyle(ButtonStyle.Danger)
      );

      await msg.channel.send({ embeds: [embedResultado], components: [row] });

      await db.set(`venda_temp_${userId}`, {
        ilhaNome: ilha.nome,
        distribuicoes,
        valorEstimado,
      });
    });
  },

  async button(interaction, { action, rest }) {
    const userId = interaction.user.id;
    const venda = await db.get(`venda_temp_${userId}`);
    if (!venda) return interaction.reply({ content: "❌ Venda expirada ou inválida.", ephemeral: true });

    if (action === "cancelar") {
      await db.delete(`venda_temp_${userId}`);
      return interaction.update({ content: "❌ Venda cancelada.", embeds: [], components: [] });
    }

    const ilhas = await db.get("ilhas_data") || [];
    const index = ilhas.findIndex(i => i.nome === venda.ilhaNome);
    if (index === -1) return interaction.reply({ content: "❌ Ilha não encontrada.", ephemeral: true });

    const ilha = ilhas[index];

    if (action === "recalcular") {
      const participacoes = ilha.participacoes || {};
      const totalPercentual = Object.values(participacoes).reduce((a, b) => a + b, 0);
      const percentualDono = participacoes[userId] || 0;

      const bonus = ilha.popularidade * 0.015 + ilha.lucroPercentual * 0.01;
      const fatorMercado = 1.1 + bonus;
      const valorEstimado = Math.round(ilha.valorMercado * fatorMercado);

      const distribuicoes = [];
      for (const [id, porcento] of Object.entries(participacoes)) {
        const valor = Math.round((porcento / 100) * valorEstimado);
        distribuicoes.push({ id, porcento, valor });
      }

      const embedResultado = new EmbedBuilder()
        .setTitle(`📜 Nova Avaliação da Ilha: ${ilha.nome}`)
        .setDescription(`💰 Novo valor estimado: **${valorEstimado.toLocaleString()} berries**`)
        .setColor("Green")
        .addFields([
          { name: "🏦 Lucro do Dono", value: `${Math.round((percentualDono / 100) * valorEstimado).toLocaleString()} berries (${percentualDono}%)`, inline: true },
          { name: "👥 Participações", value: distribuicoes.filter(d => d.id !== userId).map(d => `<@${d.id}> recebe **${d.valor.toLocaleString()} berries** (${d.porcento}%)`).join("\n") || "Nenhuma", inline: false }
        ]);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`venderilha:confirmar:${ilha.nome}`)
          .setLabel("✅ Vender")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`venderilha:recalcular:${ilha.nome}`)
          .setLabel("🔄 Recalcular")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`venderilha:cancelar`)
          .setLabel("❌ Cancelar")
          .setStyle(ButtonStyle.Danger)
      );

      await db.set(`venda_temp_${userId}`, {
        ilhaNome: ilha.nome,
        distribuicoes,
        valorEstimado
      });

      return interaction.update({ embeds: [embedResultado], components: [row] });
    }

    if (action === "confirmar") {
      // Transfere berries
      for (const dist of venda.distribuicoes) {
        const saldo = await db.get(`berries_${dist.id}`) || 0;
        await db.set(`berries_${dist.id}`, saldo + dist.valor);
      }

      // Resetar a ilha
      ilha.dono = null;
      ilha.participacoes = {};

      ilhas[index] = ilha;
      await db.set("ilhas_data", ilhas);
      await db.delete(`venda_temp_${userId}`);

      await interaction.update({
        content: `✅ Ilha **${ilha.nome}** foi vendida por **${venda.valorEstimado.toLocaleString()} berries**!\nOs lucros foram distribuídos proporcionalmente.`,
        embeds: [],
        components: []
      });
    }
  }
};