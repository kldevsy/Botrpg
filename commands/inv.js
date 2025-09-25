const { QuickDB } = require('quick.db');
const db = new QuickDB();
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dadosEspadas = require('../espadas.json');
const dadosEquipamentos = require('../equipamentos.json');

module.exports = {
  name: "inv",
  aliases: ["inventario", "itens"],

  async execute(message) {
    const userId = message.author.id;
    const criado = await db.get(`criado_${userId}`);
    if (!criado) return message.reply("❌ Você ainda não criou seu personagem! Use `!iniciar`.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('inv:categoria:espadas').setLabel('⚔️ Espadas').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('inv:categoria:equipamentos').setLabel('🛡️ Equipamentos').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('inv:categoria:frutas').setLabel('🍇 Frutas').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('inv:categoria:baus').setLabel('📦 Baús').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('inv:categoria:cosmeticos').setLabel('🎨 Cosméticos').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🎒 Seu Inventário")
      .setDescription("Escolha uma categoria abaixo para visualizar seus itens.")
      .setColor("#f1c40f");

    return message.channel.send({ embeds: [embed], components: [row] });
  },

  async button(interaction) {
    const userId = interaction.user.id;
    const [_, acao, categoriaRaw, paginaRaw] = interaction.customId.split(":");
    const categoria = categoriaRaw;
    const pagina = parseInt(paginaRaw) || 1;

    const slotsMax = await db.get(`slots_max_${userId}`) || 10;

    // Buscar os itens conforme a categoria
    let lista = [];
    if (categoria === "espadas") {
      const espadasIDs = await db.get(`espadas_${userId}`) || [];
      lista = espadasIDs.map(id => dadosEspadas.espadas.find(e => e.id === id)).filter(e => e);
    } else if (categoria === "equipamentos") {
  let equipamentosIDs = await db.get(`equipamentos_${userId}`);
  if (!Array.isArray(equipamentosIDs)) equipamentosIDs = [];
  lista = equipamentosIDs
    .map(id => dadosEquipamentos.equipamentos.find(e => e.id === id))
    .filter(e => e);
    } else {
      lista = await db.get(`${categoria}_${userId}`) || [];
    }

    const slotsUsados = (
      ((await db.get(`espadas_${userId}`)) || []).length +
      ((await db.get(`equipamentos_${userId}`)) || []).length +
      ((await db.get(`frutas_inventario_${userId}`)) || []).length +
      ((await db.get(`baus_${userId}`)) || []).length +
      ((await db.get(`cosmeticos_${userId}`)) || []).length
    );

    if (lista.length === 0) {
      return interaction.reply({ content: `📭 Você não possui itens na categoria **${categoria}**.`, ephemeral: true });
    }

    const itensPorPagina = 5;
    const totalPaginas = Math.ceil(lista.length / itensPorPagina);
    const paginaAtual = Math.min(Math.max(pagina, 1), totalPaginas);
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const itensPaginados = lista.slice(inicio, fim);

    let descricao = "";

    for (const item of itensPaginados) {
      const nome = item.nome || "Item";
      const raridade = item.raridade?.toUpperCase() || "COMUM";
      const preco = item.preco || 0;
      const durabilidade = item.durabilidade !== undefined && item.durabilidadeMax !== undefined
        ? `Durabilidade: ${item.durabilidade}/${item.durabilidadeMax}`
        : "";
      const bonus = item.bonus
        ? Object.entries(item.bonus).map(([stat, val]) => `+${val} ${stat}`).join(", ")
        : null;
      const quantidade = item.quantidade ? ` ×${item.quantidade}` : "";

      descricao += `**${nome}**${quantidade} (${raridade})\n`;
      if (bonus) descricao += `Bônus: ${bonus}\n`;
      descricao += `Valor: ${preco} berries\n`;
      if (durabilidade) descricao += `${durabilidade}\n`;
      descricao += `\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📂 Inventário – ${categoria.charAt(0).toUpperCase() + categoria.slice(1)}`)
      .setDescription(descricao)
      .setColor("#f39c12")
      .setFooter({ text: `Página ${paginaAtual}/${totalPaginas} | Slots usados: ${slotsUsados}/${slotsMax}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`inv:categoria:${categoria}:${paginaAtual - 1}`)
        .setLabel("⬅️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(paginaAtual === 1),

      new ButtonBuilder()
        .setCustomId(`inv:categoria:${categoria}:${paginaAtual + 1}`)
        .setLabel("➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(paginaAtual === totalPaginas)
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }
};