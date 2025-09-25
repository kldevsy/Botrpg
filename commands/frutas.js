const { QuickDB } = require("quick.db");
const db = new QuickDB();
const frutasDB = require("../frutas.json").frutas;
const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");

const comerFrutaCmd = require("./comerfruta.js");

async function gerarEmbed(userId, frutasUnicas, index) {
  const fruta = frutasUnicas[index];
  const frutaInfo = frutasDB.find((f) => f.id === fruta.id);
  const emoji = frutaInfo?.emoji || "🍇";
  const nivel = (await db.get(`fruta_nivel_${userId}_${fruta.id}`)) || 1;
  const xp = (await db.get(`fruta_xp_${userId}_${fruta.id}`)) || 0;
  const xpNecessario = 100 + (nivel - 1) * 150;
  const quantidadeTexto = fruta.quantidade > 1 ? `(${fruta.quantidade}x)` : "";

  return new EmbedBuilder()
    .setTitle(`📦 Fruta ${index + 1} de ${frutasUnicas.length}`)
    .setDescription(
      `**${emoji} ${fruta.nome} ${quantidadeTexto}**\n` +
        `Raridade: ${fruta.raridade}\nNível: \`Lv. ${nivel}\` | XP: \`${xp}/${xpNecessario}\``
    )
    .setColor("#9b59b6");
}

function gerarBotoes(index, max) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`frutas:anterior`)
        .setLabel("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(index === 0),
      new ButtonBuilder()
        .setCustomId(`frutas:comer`)
        .setLabel("🍽 Comer fruta")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`frutas:dropar`)
        .setLabel("📄 Dropar fruta")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`frutas:proximo`)
        .setLabel("➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(index === max - 1)
    ),
  ];
}

function gerarBotoesConfirmacao(acao, frutaSelecionada) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`frutas:confirmar:${acao}:${frutaSelecionada.id}`)
        .setLabel("Confirmar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`frutas:cancelar:${acao}:${frutaSelecionada.id}`)
        .setLabel("Cancelar")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

module.exports = {
  name: "frutas",
  aliases: ["meusfrutas", "frutasinv"],
  description: "Abre o menu de gerenciamento de frutas do jogador.",

  async execute(message) {
    const userId = message.author.id;
    const criado = await db.get(`criado_${userId}`);
    if (!criado)
      return message.reply("❌ Você ainda não criou seu personagem! Use !iniciar.");

    const frutas = (await db.get(`frutas_inventario_${userId}`)) || [];
    if (frutas.length === 0)
      return message.reply("📦 Você não possui nenhuma fruta no inventário.");

    // Agrupa frutas iguais
    const frutasAgrupadas = {};
    frutas.forEach((f) => {
      if (!frutasAgrupadas[f.id]) {
        frutasAgrupadas[f.id] = { ...f, quantidade: 1 };
      } else {
        frutasAgrupadas[f.id].quantidade++;
      }
    });

    const frutasUnicas = Object.values(frutasAgrupadas);
    await db.set(`frutas_menu_${userId}`, { frutasUnicas, indexAtual: 0 });

    const embed = await gerarEmbed(userId, frutasUnicas, 0);
    const components = gerarBotoes(0, frutasUnicas.length);

    await message.channel.send({ embeds: [embed], components });
  },

  // Define ações internas do botão para delegação
  actions: {
    async anterior(interaction) {
      const userId = interaction.user.id;
      const menu = await db.get(`frutas_menu_${userId}`);
      if (!menu) return interaction.reply({ content: "❌ Menu expirado.", ephemeral: true });

      if (menu.indexAtual > 0) menu.indexAtual--;
      await db.set(`frutas_menu_${userId}`, menu);

      const embed = await gerarEmbed(userId, menu.frutasUnicas, menu.indexAtual);
      const components = gerarBotoes(menu.indexAtual, menu.frutasUnicas.length);
      await interaction.update({ embeds: [embed], components });
    },

    async proximo(interaction) {
      const userId = interaction.user.id;
      const menu = await db.get(`frutas_menu_${userId}`);
      if (!menu) return interaction.reply({ content: "❌ Menu expirado.", ephemeral: true });

      if (menu.indexAtual < menu.frutasUnicas.length - 1) menu.indexAtual++;
      await db.set(`frutas_menu_${userId}`, menu);

      const embed = await gerarEmbed(userId, menu.frutasUnicas, menu.indexAtual);
      const components = gerarBotoes(menu.indexAtual, menu.frutasUnicas.length);
      await interaction.update({ embeds: [embed], components });
    },

    async comer(interaction) {
      const userId = interaction.user.id;
      const menu = await db.get(`frutas_menu_${userId}`);
      if (!menu) return interaction.reply({ content: "❌ Menu expirado.", ephemeral: true });

      const frutaSelecionada = menu.frutasUnicas[menu.indexAtual];
      if (!frutaSelecionada) return interaction.reply({ content: "❌ Fruta não encontrada.", ephemeral: true });

      const frutaInfo = frutasDB.find((f) => f.id === frutaSelecionada.id);
      const emoji = frutaInfo?.emoji || "🍇";

      const embedConfirm = new EmbedBuilder()
        .setTitle(`❓ Confirmação para comer fruta`)
        .setDescription(`Você tem certeza que deseja comer a fruta ${emoji} **${frutaSelecionada.nome}**?`)
        .setColor("#f39c12");

      const components = gerarBotoesConfirmacao("comer", frutaSelecionada);
      await interaction.update({ embeds: [embedConfirm], components });
    },

    async dropar(interaction) {
      const userId = interaction.user.id;
      const menu = await db.get(`frutas_menu_${userId}`);
      if (!menu) return interaction.reply({ content: "❌ Menu expirado.", ephemeral: true });

      const frutaSelecionada = menu.frutasUnicas[menu.indexAtual];
      if (!frutaSelecionada) return interaction.reply({ content: "❌ Fruta não encontrada.", ephemeral: true });

      const frutaInfo = frutasDB.find((f) => f.id === frutaSelecionada.id);
      const emoji = frutaInfo?.emoji || "🍇";

      const embedConfirm = new EmbedBuilder()
        .setTitle(`❓ Confirmação para dropar fruta`)
        .setDescription(`Você tem certeza que deseja dropar a fruta ${emoji} **${frutaSelecionada.nome}**?`)
        .setColor("#f39c12");

      const components = gerarBotoesConfirmacao("dropar", frutaSelecionada);
      await interaction.update({ embeds: [embedConfirm], components });
    },

    async confirmar(interaction, acao, frutaId) {
      const userId = interaction.user.id;
      const menu = await db.get(`frutas_menu_${userId}`);
      if (!menu) return interaction.reply({ content: "❌ Menu expirado.", ephemeral: true });

      const frutaSelecionada = menu.frutasUnicas[menu.indexAtual];
      if (!frutaSelecionada) return interaction.reply({ content: "❌ Fruta não encontrada.", ephemeral: true });

      if (frutaId !== frutaSelecionada.id)
        return interaction.reply({ content: "❌ Essa fruta não é a selecionada atualmente.", ephemeral: true });

      if (acao === "comer") {
        try {
          await comerFrutaCmd.run(interaction, frutaSelecionada.id);
          
        } catch (err) {
          console.error("Erro ao comer fruta:", err);
          await interaction.update({
            content: "❌ Ocorreu um erro ao comer a fruta.",
            embeds: [],
            components: [],
          });
        }
      } else if (acao === "dropar") {
        let inventario = (await db.get(`frutas_inventario_${userId}`)) || [];
        const indexInv = inventario.findIndex((f) => f.id === frutaSelecionada.id);
        if (indexInv !== -1) {
          inventario.splice(indexInv, 1);
          await db.set(`frutas_inventario_${userId}`, inventario);
        }

        const frutaInfo = frutasDB.find((f) => f.id === frutaSelecionada.id);
        const emoji = frutaInfo?.emoji || "🍇";

        const dropEmbed = new EmbedBuilder()
          .setTitle("📤 Fruta Dropada!")
          .setDescription(`${interaction.user} dropou a fruta ${emoji} **${frutaSelecionada.nome}**!\nClique abaixo para pegá-la!`)
          .setColor("#e74c3c");

        const dropButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`frutas:pegar:${frutaSelecionada.id}`)
            .setLabel("🍴 Pegar fruta")
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.channel.send({ embeds: [dropEmbed], components: [dropButton] });

        await interaction.update({
          content: "📤 Você dropou a fruta.",
          embeds: [],
          components: [],
        });
      }
    },

    async cancelar(interaction, acao, frutaId) {
      const userId = interaction.user.id;
      const menu = await db.get(`frutas_menu_${userId}`);
      if (!menu) return interaction.reply({ content: "❌ Menu expirado.", ephemeral: true });

      const frutasUnicas = menu.frutasUnicas;
      const indexAtual = menu.indexAtual;

      const embed = await gerarEmbed(userId, frutasUnicas, indexAtual);
      const components = gerarBotoes(indexAtual, frutasUnicas.length);

      await interaction.update({ embeds: [embed], components });
    },

    async pegar(interaction, frutaId) {
      const userId = interaction.user.id;
      const frutaInfo = frutasDB.find((f) => f.id === frutaId);
      if (!frutaInfo) {
        return interaction.reply({ content: "❌ Essa fruta não existe mais!", ephemeral: true });
      }

      const inventario = (await db.get(`frutas_inventario_${userId}`)) || [];
      inventario.push({
        id: frutaInfo.id,
        nome: frutaInfo.nome,
        raridade: frutaInfo.raridade,
      });
      await db.set(`frutas_inventario_${userId}`, inventario);

      await interaction.reply({
        content: `🍴 Você pegou a fruta **${frutaInfo.nome}** com sucesso!`,
        ephemeral: true,
      });

      try {
        await interaction.message.edit({ components: [] });
      } catch {}

    },
  },

  async button(interaction) {
    if (!interaction.customId.startsWith("frutas:"))
      return interaction.reply({ content: "❌ Botão inválido para este comando.", ephemeral: true });

    const args = interaction.customId.split(":").slice(1); // remove 'frutas'
    const acao = args[0];
    const frutaId = args[1];
    const extra = args[2]; // caso queira usar terceiro argumento no futuro

    if (typeof this.actions[acao] === "function") {
      try {
        // Chama a ação, passando interação, frutaId e extra (se precisar)
        await this.actions[acao](interaction, frutaId, extra);
      } catch (error) {
        console.error("Erro no botão frutas:", error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "❌ Ocorreu um erro inesperado.", ephemeral: true });
        }
      }
    } else {
      // Se a ação não existir
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌ Botão inválido ou não implementado.", ephemeral: true });
      }
    }
  }
}