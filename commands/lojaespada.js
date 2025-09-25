const { QuickDB } = require('quick.db');
const db = new QuickDB();
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dadosLoja = require('../espadas.json');

module.exports = {
  name: "lojaespada",
  aliases: ["lespada", "lojaspadas"],

  async execute(message) {
    const userId = message.author.id;
    const criado = await db.get(`criado_${userId}`);
    if (!criado) return message.reply("❌ Você ainda não criou seu personagem! Use `!iniciar`.");

    const lojaEspadas = dadosLoja.espadas.filter(e => e.loja);
    if (!lojaEspadas.length) return message.reply("⚠️ Nenhuma espada está disponível na loja no momento.");

    let pagina = 0;
    const totalPaginas = Math.ceil(lojaEspadas.length / 5);

    const embed = gerarEmbed(lojaEspadas, pagina, totalPaginas);
    const row = gerarBotoes(pagina, totalPaginas);

    await message.channel.send({ embeds: [embed], components: [row] });
  },

  async button(interaction) {
    const [comando, acao] = interaction.customId.split(":");
    const userId = interaction.user.id;

    const lojaEspadas = dadosLoja.espadas.filter(e => e.loja);
    const totalPaginas = Math.ceil(lojaEspadas.length / 5);

    const msg = interaction.message;
    const embedAtual = msg.embeds[0];
    let paginaAtual = 0;

    // Página atual com base no footer
    const footerText = embedAtual?.footer?.text;
    if (footerText) {
      const match = footerText.match(/Página (\d+) de (\d+)/);
      if (match) paginaAtual = parseInt(match[1]) - 1;
    }

    if (acao === "proxima") {
      paginaAtual++;
      if (paginaAtual >= totalPaginas) paginaAtual = totalPaginas - 1;
    } else if (acao === "anterior") {
      paginaAtual--;
      if (paginaAtual < 0) paginaAtual = 0;
    }

    if (acao === "proxima" || acao === "anterior") {
      const embed = gerarEmbed(lojaEspadas, paginaAtual, totalPaginas);
      const row = gerarBotoes(paginaAtual, totalPaginas);
      return interaction.update({ embeds: [embed], components: [row] });
    }

    if (acao === "comprar") {
      await interaction.reply({ content: "Digite o **ID da espada** que deseja comprar (ex: `esp001`). Você tem 30 segundos.", ephemeral: true });

      const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === userId,
        time: 30_000,
        max: 1
      });

      collector.on("collect", async (msg) => {
        const id = msg.content.trim();
        const espada = dadosLoja.espadas.find(e => e.id === id && e.loja);
        if (!espada) return msg.reply("❌ Espada não encontrada ou não está à venda.");

        const saldo = await db.get(`berries_${userId}`) || 0;
        if (saldo < espada.preco) return msg.reply("💸 Você não tem berries suficientes.");

        let espadas = await db.get(`espadas_${userId}`);
        if (!Array.isArray(espadas)) espadas = [];

        if (espadas.includes(espada.id)) return msg.reply("⚠️ Você já possui essa espada.");

        const saldoAtual = await db.get(`berries_${userId}`) || 0;
await db.set(`berries_${userId}`, saldoAtual - espada.preco);
        espadas.push(espada.id);
        await db.set(`espadas_${userId}`, espadas);

        return msg.reply(`✅ Você comprou a espada **${espada.nome}** com sucesso!`);
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          interaction.followUp({ content: "⏱️ Tempo expirado. Nenhuma espada foi comprada.", ephemeral: true });
        }
      });
    }
  }
};

// Função auxiliar para gerar o Embed da loja
function gerarEmbed(lista, pagina, totalPaginas) {
  const embed = new EmbedBuilder()
    .setTitle("🛒 Loja de Espadas")
    .setColor("#1abc9c")
    .setDescription("Clique em **🛒 Comprar uma espada** e digite o ID para comprar.")
    .setFooter({ text: `Página ${pagina + 1} de ${totalPaginas}` });

  const inicio = pagina * 5;
  const itens = lista.slice(inicio, inicio + 5);

  for (const espada of itens) {
    const habilidades = espada.habilidades.map(h => `**${h.nome}**: ${h.descricao}`).join("\n");
    embed.addFields({
      name: `⚔️ ${espada.nome} (${espada.raridade.toUpperCase()}) - ${espada.preco} berries`,
      value: `ID: \`${espada.id}\`\n${espada.descricao}\n**Dano:** ${espada.dano}\n${habilidades}`
    });
  }

  return embed;
}

// Função auxiliar para gerar os botões
function gerarBotoes(pagina, totalPaginas) {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("lojaespada:comprar")
        .setLabel("🛒 Comprar uma espada")
        .setStyle(ButtonStyle.Primary)
    );

  if (totalPaginas > 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("lojaespada:anterior")
        .setLabel("⏪")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina === 0),

      new ButtonBuilder()
        .setCustomId("lojaespada:proxima")
        .setLabel("⏩")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina === totalPaginas - 1)
    );
  }

  return row;
}