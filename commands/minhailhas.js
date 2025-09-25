const { QuickDB } = require("quick.db");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = new QuickDB();

async function getIlhas() {
  let ilhas = await db.get("ilhas_data");
  if (!ilhas) {
    ilhas = require("../ilhas.json").ilhas;
    await db.set("ilhas_data", ilhas);
  }
  return ilhas;
}

function formatIlhasDoUsuario(ilhas, userId, page, perPage = 5) {
  const minhasIlhas = ilhas.filter(i => i.dono === userId || (i.participacoes && i.participacoes[userId]));
  const start = page * perPage;
  const pageIlhas = minhasIlhas.slice(start, start + perPage);

  const embed = new EmbedBuilder()
    .setTitle("📜 Suas Ilhas")
    .setColor("Gold");

  if (pageIlhas.length === 0) {
    embed.setDescription("Você ainda não possui nenhuma ilha ou ações.");
  } else {
    embed.setDescription(`Página ${page + 1} de ${Math.ceil(minhasIlhas.length / perPage)}`);
    pageIlhas.forEach(i => {
      //const participacoes = i.participacoes || {};
      const participacoes = i.participacoes || {};
      const minhaParticipacao = participacoes[userId] || 0;
      const souDono = i.dono === userId;

      const descricao = souDono
        ? `Você é o dono e possui ${minhaParticipacao}% da ilha.`
        : `Você possui ${minhaParticipacao}% de participação.`;
      const participacao = i.dono === userId
        ? 100 - (Object.values(participacoes).reduce((a, b) => a + b, 0))
        : participacoes[userId] || 0;

      embed.addFields({
        name: `${i.nome} - Renda: ${i.rendaBase.toLocaleString()} berries`,
        value:
          `Lucro: ${i.lucroPercentual}% | Estado: ${i.estado} | Tributação: ${i.tributacao}%\n` +
          `Tendência: ${i.tendencia} | 🧩 Participação: ${descricao}%`,
        inline: false,
      });
    });
  }

  return embed;
}

module.exports = {
  name: "minhailhas",
  description: "Veja e gerencie suas ilhas e ações adquiridas",
  states: new Map(),

  async execute(message) {
    const userId = message.author.id;
    const ilhas = await getIlhas();
    const page = 0;

    const embed = formatIlhasDoUsuario(ilhas, userId, page);
    const row = this.createRow(ilhas, userId, page);
    this.states.set(message.id, { userId, page });

    await message.reply({ embeds: [embed], components: [row] });
  },

  async button(interaction, { action }) {
    const msgId = interaction.message?.reference?.messageId || interaction.message.id;
    const state = this.states.get(msgId);

    if (!state || state.userId !== interaction.user.id) {
      return interaction.reply({ content: "❌ Você não pode usar esse botão.", ephemeral: true });
    }

    const ilhas = await getIlhas();
    const minhasIlhas = ilhas.filter(i => i.dono === state.userId || (i.participacoes && i.participacoes[state.userId]));
    const maxPage = Math.ceil(minhasIlhas.length / 5) - 1;

    if (action === "next") {
      if (state.page < maxPage) state.page++;
    } else if (action === "prev") {
      if (state.page > 0) state.page--;
    } else if (action === "resgatar") {
      const lucro = await db.get(`lucro_acumulado_${state.userId}`) || 0;
      if (lucro <= 0) return interaction.reply({ content: "💤 Você não possui lucro acumulado.", ephemeral: true });

      const atual = await db.get(`berries_${state.userId}`) || 0;
      await db.set(`berries_${state.userId}`, atual + lucro);
      await db.set(`lucro_acumulado_${state.userId}`, 0);

      return interaction.reply({ content: `💰 Você resgatou **${lucro.toLocaleString()} berries** de lucro acumulado.`, ephemeral: true });
    } else if (action === "log") {
      const userId = interaction.user.id;
      const ilhasPagina = minhasIlhas.slice(state.page * 5, state.page * 5 + 5);
      if (ilhasPagina.length === 0) return interaction.reply({ content: "❌ Nenhuma ilha nesta página.", ephemeral: true });

      const ilha = ilhasPagina[0];
      const embed = new EmbedBuilder().setColor("DarkBlue").setTitle("📊 Log da Ilha");

      const lucroTotal = ilha.logs?.[userId]?.lucroTotal || 0;
      const perdas = ilha.logs?.[userId]?.perdas || 0;
      const lucroAcumulado = await db.get(`lucro_acumulado_${userId}`) || 0;

      const lucroDiario = await db.get(`lucro_historico_dia_${userId}`) || {};
      const lucroSemanal = await db.get(`lucro_historico_semana_${userId}`) || {};

      const ultimosDias = Object.entries(lucroDiario)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 3)
        .map(([dia, v]) => `${dia}: ${v.toLocaleString()} berries`)
        .join("\n") || "*Sem dados*";

      const ultimasSemanas = Object.entries(lucroSemanal)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 2)
        .map(([sem, v]) => `${sem}: ${v.toLocaleString()} berries`)
        .join("\n") || "*Sem dados*";

      embed.setDescription(`📍 Ilha: **${ilha.nome}**`);
      embed.addFields(
        { name: "💰 Lucro Total Recebido", value: `${lucroTotal.toLocaleString()} berries`, inline: true },
        { name: "📉 Perdas/Tributos", value: `${perdas.toLocaleString()} berries`, inline: true },
        { name: "💸 Lucros gerados (acumulados)", value: `${lucroAcumulado.toLocaleString()} berries`, inline: false },
        { name: "📆 Últimos dias", value: ultimosDias, inline: false },
        { name: "📅 Últimas semanas", value: ultimasSemanas, inline: false }
      );

      const participacoes = ilha.participacoes || { [ilha.dono]: 100 };
      const lista = Object.entries(participacoes)
        .map(([uid, p]) => `<@${uid}>: ${p}%`)
        .join("\n");

      embed.addFields({ name: "👥 Participações", value: lista });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const embed = formatIlhasDoUsuario(ilhas, state.userId, state.page);
    const row = this.createRow(ilhas, state.userId, state.page);
    await interaction.update({ embeds: [embed], components: [row] });
  },

  createRow(ilhas, userId, page) {
    const minhasIlhas = ilhas.filter(i => i.dono === userId || (i.participacoes && i.participacoes[userId]));
    const maxPage = Math.ceil(minhasIlhas.length / 5) - 1;

    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("minhailhas:prev")
        .setLabel("⬅️ Anterior")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),

      new ButtonBuilder()
        .setCustomId("minhailhas:log")
        .setLabel("📊 Log")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(minhasIlhas.length === 0),

      new ButtonBuilder()
        .setCustomId("minhailhas:resgatar")
        .setLabel("💰 Resgatar Lucro")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("minhailhas:next")
        .setLabel("Próximo ➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= maxPage)
    );
  }
};