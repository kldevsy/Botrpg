const { QuickDB } = require("quick.db");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const db = new QuickDB();

// Mutex simples para evitar concorrência na compra de ilhas
const mutexIlhas = new Set();

async function getIlhas() {
  //await db.delete("ilhas_data"); // Força carregamento do JSON original
  let ilhas = await db.get("ilhas_data");
  if (!ilhas) {
    ilhas = require("../ilhas.json").ilhas;
    await db.set("ilhas_data", ilhas);
  }
  return ilhas;
}

async function setIlhas(novasIlhas) {
  await db.set("ilhas_data", novasIlhas);
}


function aplicarFiltro(ilhas, filtro) {
  if (!filtro) return ilhas;

  switch (filtro) {
    case "semdono":
      return ilhas.filter(ilha => !ilha.dono);
    case "bomestado":
      return ilhas.filter(ilha => ["Bom", "Ótimo", "Excelente"].includes(ilha.estado));
    case "otimolucro":
      return ilhas.filter(ilha => ilha.lucroPercentual >= 20);
    case "beneficios":
      return ilhas.filter(ilha => ilha.tributacao <= 10 && ilha.rendaBase >= 5000);
    default:
      return ilhas;
  }
}

function formatIlhasPage(ilhas, page, perPage = 5) {
  const start = page * perPage;
  const selected = ilhas.slice(start, start + perPage);

  const embed = new EmbedBuilder()
    .setTitle("Mercado de Ilhas - One Piece RPG")
    .setDescription(`Página ${page + 1} de ${Math.ceil(ilhas.length / perPage)}\nClique no botão para comprar a ilha disponível da página.`);

  if (selected.length === 0) {
    embed.setDescription("Nenhuma ilha encontrada com este filtro.");
  } else {
    selected.forEach(ilha => {
      embed.addFields({
        name: `${ilha.nome} - Valor: ${ilha.valorMercado.toLocaleString()} berries`,
        value:
          `Renda: ${ilha.rendaBase.toLocaleString()} berries | Lucro: ${ilha.lucroPercentual}% | Estado: ${ilha.estado}\n` +
          `Dono: ${ilha.dono ? `<@${ilha.dono}>` : "Disponível"}\n` +
          `Tendência: ${ilha.tendencia} | Tributação: ${ilha.tributacao}%\n`,
        inline: false,
      });
    });
  }

  return embed;
}

module.exports = {
  name: "mercadoilhas2",
  description: "Mercado de ilhas com paginação, compra e filtros",
  states: new Map(),

  async execute(message) {
    const ilhas = await getIlhas();
    const perPage = 5;
    const currentPage = 0;
    const filtro = null;

    this.states.set(message.id, { currentPage, filtro, userId: message.author.id });

    const ilhasFiltradas = aplicarFiltro(ilhas, filtro);
    const embed = formatIlhasPage(ilhasFiltradas, currentPage, perPage);

    const row = createRow(ilhasFiltradas, currentPage, perPage);

    await message.reply({ embeds: [embed], components: [row] });
  },

  async button(interaction, { action, rest }) {
    let state = this.states.get(interaction.message.id);
    if (!state) {
      state = { currentPage: 0, filtro: null, userId: interaction.user.id };
      this.states.set(interaction.message.id, state);
    }

    const ilhas = await getIlhas();
    const perPage = 5;

    if (action === "prev") {
      if (state.currentPage > 0) state.currentPage--;
    } else if (action === "next") {
      const ilhasFiltradas = aplicarFiltro(ilhas, state.filtro);
      if (state.currentPage < Math.ceil(ilhasFiltradas.length / perPage) - 1) state.currentPage++;
    } else if (action === "comprar") {
      const ilhasFiltradas = aplicarFiltro(ilhas, state.filtro);
      const ilhasPagina = ilhasFiltradas.slice(state.currentPage * perPage, state.currentPage * perPage + perPage);
      const ilhasDisponiveis = ilhasPagina.filter(ilha => !ilha.dono);

      if (ilhasDisponiveis.length === 0) {
        return interaction.reply({ content: "Nenhuma ilha disponível para compra nesta página.", ephemeral: true });
      }

      const userId = state.userId;

      await interaction.reply({
        content:
          `Digite o nome exato da ilha que deseja comprar nesta página:\n` +
          ilhasDisponiveis.map(i => `- ${i.nome} (Valor: ${i.valorMercado.toLocaleString()} berries)`).join("\n") +
          `\n\nVocê tem 30 segundos para digitar o nome.`,
        ephemeral: true,
      });

      const filterMsg = m => m.author.id === userId;
      const collector = interaction.channel.createMessageCollector({ filter: filterMsg, time: 30000, max: 1 });

      collector.on("collect", async m => {
        const nomeDigitado = m.content.trim().toLowerCase();

        if (mutexIlhas.has(nomeDigitado)) {
          return m.reply("⏳ Esta ilha está sendo comprada por outro jogador. Tente novamente em alguns segundos.");
        }

        mutexIlhas.add(nomeDigitado);

        try {
          const ilhasAtualizadas = await getIlhas();
          const indexIlha = ilhasAtualizadas.findIndex(i => i.nome.toLowerCase() === nomeDigitado);

          if (indexIlha === -1) return m.reply("❌ Ilha não encontrada.");
          const ilhaSelecionada = ilhasAtualizadas[indexIlha];

          if (ilhaSelecionada.dono) return m.reply("❌ Essa ilha já foi comprada.");

          let berriesUser = await db.get(`berries_${userId}`) || 0;

          if (berriesUser < ilhaSelecionada.valorMercado) {
            return m.reply(`❌ Você não tem berries suficientes. Precisa de ${ilhaSelecionada.valorMercado.toLocaleString()}.`);
          }

          await db.set(`berries_${userId}`, berriesUser - ilhaSelecionada.valorMercado);
          ilhasAtualizadas[indexIlha].dono = userId;
          ilhasAtualizadas[indexIlha].participacoes = { [userId]: 100 };
          await setIlhas(ilhasAtualizadas);

          await m.reply(`✅ Parabéns! Você comprou a ilha **${ilhaSelecionada.nome}**.`);

          const ilhasFiltradas = aplicarFiltro(ilhasAtualizadas, state.filtro);
          const embed = formatIlhasPage(ilhasFiltradas, state.currentPage, perPage);
          const row = createRow(ilhasFiltradas, state.currentPage, perPage);

          await interaction.message.edit({ embeds: [embed], components: [row] });

        } finally {
          mutexIlhas.delete(nomeDigitado);
        }
      });

      collector.on("end", collected => {
        if (collected.size === 0) {
          interaction.followUp({ content: "⏰ Tempo expirado. Compra cancelada.", ephemeral: true });
        }
      });

      return;
    } else if (action === "filtros") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("mercadoilhas:aplicar:semdono").setLabel("📋 Sem donos").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("mercadoilhas:aplicar:bomestado").setLabel("📉 Bom estado").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("mercadoilhas:aplicar:otimolucro").setLabel("💰 Ótimos lucros").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("mercadoilhas:aplicar:beneficios").setLabel("❓ Benefícios").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("mercadoilhas:aplicar:limpar").setLabel("✖️ Limpar filtro").setStyle(ButtonStyle.Danger)
      );

      return await interaction.update({ content: "Escolha o filtro:", embeds: [], components: [row] });
    } else if (action === "aplicar") {
      const filtroEscolhido = rest[0];

      if (filtroEscolhido === "limpar") state.filtro = null;
      else state.filtro = filtroEscolhido;

      state.currentPage = 0;

      const ilhasFiltradas = aplicarFiltro(ilhas, state.filtro);
      const embed = formatIlhasPage(ilhasFiltradas, state.currentPage, perPage);
      const row = createRow(ilhasFiltradas, state.currentPage, perPage);

      return await interaction.update({ embeds: [embed], components: [row], content: null });
    }

    const ilhasFiltradas = aplicarFiltro(ilhas, state.filtro);
    const embed = formatIlhasPage(ilhasFiltradas, state.currentPage, perPage);
    const row = createRow(ilhasFiltradas, state.currentPage, perPage);

    await interaction.update({ embeds: [embed], components: [row] });
  },
};

function createRow(ilhasFiltradas, page, perPage) {
  const row = new ActionRowBuilder();
  const algumaDisponivel = ilhasFiltradas.slice(page * perPage, page * perPage + perPage).some(ilha => !ilha.dono);

  row.addComponents(
    new ButtonBuilder().setCustomId("mercadoilhas:prev").setLabel("⬅️ Anterior").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId("mercadoilhas:comprar").setLabel("🛒 Comprar").setStyle(ButtonStyle.Primary).setDisabled(!algumaDisponivel),
    new ButtonBuilder().setCustomId("mercadoilhas:next").setLabel("Próximo ➡️").setStyle(ButtonStyle.Secondary).setDisabled(page >= Math.ceil(ilhasFiltradas.length / perPage) - 1),
    new ButtonBuilder().setCustomId("mercadoilhas:filtros").setLabel("⚙️ Filtros").setStyle(ButtonStyle.Success)
  );

  return row;
}