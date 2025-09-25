const { QuickDB } = require("quick.db");
const db = new QuickDB();
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
} = require("discord.js");

const quests = require("../quests.json");
const npcs = require("../npcs.json");

module.exports = {
  name: "missao",
  aliases: ["quest", "missões"],
  description: "Visualize e aceite missões disponíveis.",

  async execute(message, args) {
    const userId = message.author.id;
    const criado = await db.get(`criado_${userId}`);
    if (!criado) {
      return message.reply("❌ Você ainda não criou seu personagem! Use `!iniciar`.");
    }

    const subcomando = args[0];
    const id = args[1];
    const questAtiva = await db.get(`quest_${userId}`);
    const level = await db.get(`nivel_${userId}`) || 1;
    const missaoAutomatica = await db.get(`auto_quest_${userId}`);

    if (subcomando === "aceitar") {
      if (!id) return message.reply("Digite o ID da missão que deseja aceitar. Ex: `!missao aceitar quest_001`");

      const questEscolhida = quests.quests.find(q => q.id === id);
      if (!questEscolhida) return message.reply("ID de missão inválido.");
      if (level < questEscolhida.nivel) {
        return message.reply("❌ Você não tem level suficiente para essa missão.");
      }

      await db.set(`quest_${userId}`, questEscolhida.id);

      const npcsDaMissao = npcs.npcs.filter(n => questEscolhida.npcId.includes(n.id));
      for (const npc of npcsDaMissao) {
        await db.set(`npc_${npc.id}_status_${userId}`, "ativo");
      }

      return message.channel.send(`✅ Missão **${questEscolhida.nome}** aceita com sucesso! Boa sorte.`);
    }

    // Paginação
    const missaoPorPagina = 5;
    let paginaAtual = 0;
    const totalPaginas = Math.ceil(quests.quests.length / missaoPorPagina);

    const gerarEmbed = (pagina) => {
      const inicio = pagina * missaoPorPagina;
      const fim = inicio + missaoPorPagina;

      const embed = new EmbedBuilder()
        .setTitle("📜 Missões Disponíveis")
        .setDescription("Use `!missao aceitar <id_da_missao>` para aceitar uma missão.")
        .setColor(0x2b2d31)
        .setFooter({
          text: `Página ${pagina + 1} de ${totalPaginas}${missaoAutomatica ? ` | Missão automática: ${missaoAutomatica}` : ""}`,
        });

      quests.quests.slice(inicio, fim).forEach(q => {
        embed.addFields({
          name: `${q.nome} (ID: ${q.id})`,
          value: `**Descrição:** ${q.descricao}\n**Recompensa:** ${q.recompensa.xp} XP, ${q.recompensa.berries} berries`,
        });
      });

      return embed;
    };

    const gerarBotoes = () =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("voltar")
          .setLabel("⬅️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(paginaAtual === 0),
        new ButtonBuilder()
          .setCustomId("avancar")
          .setLabel("➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(paginaAtual >= totalPaginas - 1),
        new ButtonBuilder()
          .setCustomId("auto")
          .setLabel("⚙️ Automático")
          .setStyle(ButtonStyle.Primary)
      );

    const msg = await message.channel.send({
      embeds: [gerarEmbed(paginaAtual)],
      components: [gerarBotoes()],
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
      filter: (i) => i.user.id === userId,
    });

    collector.on("collect", async (interaction) => {
      await interaction.deferUpdate();

      if (interaction.customId === "voltar") {
        paginaAtual--;
        await msg.edit({ embeds: [gerarEmbed(paginaAtual)], components: [gerarBotoes()] });
      }

      if (interaction.customId === "avancar") {
        paginaAtual++;
        await msg.edit({ embeds: [gerarEmbed(paginaAtual)], components: [gerarBotoes()] });
      }

      if (interaction.customId === "auto") {
        if (!missaoAutomatica) {
          await interaction.followUp({
            content: "Digite o ID da missão que deseja configurar como automática:",
            ephemeral: true,
          });

          const filterMsg = m => m.author.id === userId;
          const collected = await message.channel.awaitMessages({ filter: filterMsg, max: 1, time: 30000 });

          if (!collected.size) return message.channel.send("⏱️ Tempo esgotado.");

          const quest = quests.quests.find(q => q.id === collected.first().content);
          if (!quest) return message.channel.send("❌ ID de missão inválido.");

          await db.set(`auto_quest_${userId}`, quest.id);
          return message.channel.send(`✅ Missão automática configurada como **${quest.nome}**!`);
        } else {
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("desativar_auto")
              .setLabel("❌ Desativar")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("trocar_auto")
              .setLabel("🔁 Trocar")
              .setStyle(ButtonStyle.Primary)
          );

          const msgAuto = await message.channel.send({
            content: "Você já tem uma missão automática configurada. O que deseja fazer?",
            components: [row],
          });

          const autoCollector = msgAuto.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000,
            filter: (i) => i.user.id === userId,
          });

          autoCollector.on("collect", async (i) => {
            await i.deferUpdate();

            if (i.customId === "desativar_auto") {
              await db.delete(`auto_quest_${userId}`);
              await msgAuto.edit({ content: "❌ Missão automática desativada.", components: [] });
              autoCollector.stop();
            }

            if (i.customId === "trocar_auto") {
              await msgAuto.edit({
                content: "Digite o novo ID da missão automática:",
                components: [],
              });

              const collected = await message.channel.awaitMessages({ filter: m => m.author.id === userId, max: 1, time: 30000 });
              if (!collected.size) return message.channel.send("⏱️ Tempo esgotado.");

              const nova = quests.quests.find(q => q.id === collected.first().content);
              if (!nova) return message.channel.send("❌ ID inválido.");

              await db.set(`auto_quest_${userId}`, nova.id);
              return message.channel.send(`🔁 Missão automática atualizada para **${nova.nome}**!`);
            }
          });
        }
      }
    });

    collector.on("end", async () => {
      if (msg.editable) {
        msg.edit({ components: [] }).catch(() => {});
      }
    });
  }
};