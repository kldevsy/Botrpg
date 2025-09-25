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
  name: "missao2",
  aliases: ["quest", "missões"],
  description: "Visualize e aceite missões disponíveis.",

  async execute(message, args) {
    const userId = message.author.id;
    const criado = await db.get(`criado_${userId}`);
    if (!criado) {
      return message.reply("❌ Você ainda não criou seu personagem! Use `!iniciar`.");
    }

    this.paginaAtual = 0; // guardamos a página atual no escopo do comando para uso em button()

    const questAtiva = await db.get(`quest_${userId}`);
    const level = await db.get(`nivel_${userId}`) || 1;
    const missaoAutomatica = await db.get(`auto_quest_${userId}`);

    const totalPaginas = quests.quests.length;

    const gerarEmbed = (pagina) => {
      const quest = quests.quests[pagina];

      return new EmbedBuilder()
        .setTitle(`📜 Missão: ${quest.nome}`)
        .setDescription(`${quest.descricao}`)
        .addFields(
          { name: "Recompensa", value: `💰 ${quest.recompensa.berries} berries\n✨ ${quest.recompensa.xp} XP` },
          { name: "Requisitos", value: `🔒 Level mínimo: ${quest.nivel}` }
        )
        .setFooter({
          text: `Página ${pagina + 1} de ${totalPaginas}${missaoAutomatica ? ` | Missão automática: ${missaoAutomatica}` : ""}`,
        })
        .setColor(0x2b2d31);
    };

    const gerarBotoes = (pagina) => {
      const quest = quests.quests[pagina];
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`missao2:voltar`)
          .setLabel("⬅️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pagina === 0),
        new ButtonBuilder()
          .setCustomId(`missao2:aceitar`)
          .setLabel("📝 Aceitar")
          .setStyle(ButtonStyle.Success)
          .setDisabled(level < quest.nivel || Boolean(questAtiva)),
        new ButtonBuilder()
          .setCustomId(`missao2:avancar`)
          .setLabel("➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pagina === totalPaginas - 1),
        new ButtonBuilder()
          .setCustomId(`missao2:auto`)
          .setLabel("⚙️ Automático")
          .setStyle(ButtonStyle.Primary)
      );
    };

    const msg = await message.channel.send({
      embeds: [gerarEmbed(this.paginaAtual)],
      components: [gerarBotoes(this.paginaAtual)],
    });

    // Guardar msg para editar nas interações
    this.msg = msg;
  },

  async button(interaction) {
    // interaction.customId esperado: missao2:voltar, missao2:avancar, missao2:aceitar, missao2:auto, missao2:desativar_auto, missao2:trocar_auto
    const userId = interaction.user.id;
    if (!this.msg || interaction.message.id !== this.msg.id) {
      return interaction.reply({ content: "❌ Interação inválida ou expirou.", ephemeral: true });
    }

    // A página atual deve estar no escopo do comando - vamos salvar na própria instância do comando
    if (typeof this.paginaAtual !== "number") this.paginaAtual = 0;

    const totalPaginas = quests.quests.length;
    const questAtiva = await db.get(`quest_${userId}`);
    const level = await db.get(`nivel_${userId}`) || 1;
    const missaoAutomatica = await db.get(`auto_quest_${userId}`);

    await interaction.deferUpdate();

    const [_, acao] = interaction.customId.split(":");
    let quest = quests.quests[this.paginaAtual];

    if (acao === "voltar") {
      if (this.paginaAtual > 0) this.paginaAtual--;
      quest = quests.quests[this.paginaAtual];
      await this.msg.edit({ embeds: [this.gerarEmbed(this.paginaAtual, missaoAutomatica)], components: [this.gerarBotoes(this.paginaAtual, level, questAtiva)] });
    } else if (acao === "avancar") {
      if (this.paginaAtual < totalPaginas - 1) this.paginaAtual++;
      quest = quests.quests[this.paginaAtual];
      await this.msg.edit({ embeds: [this.gerarEmbed(this.paginaAtual, missaoAutomatica)], components: [this.gerarBotoes(this.paginaAtual, level, questAtiva)] });
    } else if (acao === "aceitar") {
      if (questAtiva) {
        return interaction.followUp({ content: "❌ Você já está em uma missão. Conclua ou cancele antes.", ephemeral: true });
      }
      if (level < quest.nivel) {
        return interaction.followUp({ content: "❌ Você não tem o nível necessário.", ephemeral: true });
      }

      await db.set(`quest_${userId}`, quest.id);
      for (const npcId of quest.npcId) {
        await db.set(`npc_${npcId}_status_${userId}`, "ativo");
      }

      await this.msg.edit({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Missão aceita!")
            .setDescription(`Você aceitou a missão **${quest.nome}**.`)
            .setColor(0x00ff88),
        ],
        components: [],
      });
    } else if (acao === "auto") {
      if (!missaoAutomatica) {
        await interaction.followUp({
          content: "Digite o ID da missão que deseja configurar como automática:",
          ephemeral: true,
        });

        const collected = await interaction.channel.awaitMessages({
          filter: m => m.author.id === userId,
          max: 1,
          time: 30000,
        });

        if (!collected.size) return interaction.followUp({ content: "⏱️ Tempo esgotado.", ephemeral: true });
        const nova = quests.quests.find(q => q.id === collected.first().content);
        if (!nova) return interaction.followUp({ content: "❌ ID inválido.", ephemeral: true });

        await db.set(`auto_quest_${userId}`, nova.id);
        return interaction.followUp({ content: `✅ Missão automática configurada: **${nova.nome}**.`, ephemeral: true });
      } else {
        // Mostrar opções para desativar ou trocar
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("missao2:desativar_auto")
            .setLabel("❌ Desativar")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("missao2:trocar_auto")
            .setLabel("🔁 Trocar")
            .setStyle(ButtonStyle.Primary)
        );

        const msgAuto = await interaction.followUp({
          content: "Missão automática já configurada. O que deseja fazer?",
          components: [row],
          ephemeral: true,
        });

        const collector = msgAuto.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000,
          filter: i => i.user.id === userId,
        });

        collector.on("collect", async i => {
          await i.deferUpdate();

          if (i.customId === "missao2:desativar_auto") {
            await db.delete(`auto_quest_${userId}`);
            await i.editReply({ content: "❌ Missão automática desativada.", components: [] });
            collector.stop();
          }

          if (i.customId === "missao2:trocar_auto") {
            await i.editReply({
              content: "Digite o novo ID da missão automática:",
              components: [],
            });

            const collected = await interaction.channel.awaitMessages({
              filter: m => m.author.id === userId,
              max: 1,
              time: 30000,
            });

            if (!collected.size) return interaction.followUp({ content: "⏱️ Tempo esgotado.", ephemeral: true });
            const nova = quests.quests.find(q => q.id === collected.first().content);
            if (!nova) return interaction.followUp({ content: "❌ ID inválido.", ephemeral: true });

            await db.set(`auto_quest_${userId}`, nova.id);
            return interaction.followUp({ content: `🔁 Missão automática atualizada: **${nova.nome}**.`, ephemeral: true });
          }
        });
      }
    }
  },

  // Funções auxiliares para embed e botões para usar no button()
  gerarEmbed(pagina, missaoAutomatica) {
    const totalPaginas = quests.quests.length;
    const quest = quests.quests[pagina];

    return new EmbedBuilder()
      .setTitle(`📜 Missão: ${quest.nome}`)
      .setDescription(`${quest.descricao}`)
      .addFields(
        { name: "Recompensa", value: `💰 ${quest.recompensa.berries} berries\n✨ ${quest.recompensa.xp} XP` },
        { name: "Requisitos", value: `🔒 Level mínimo: ${quest.nivel}` }
      )
      .setFooter({
        text: `Página ${pagina + 1} de ${totalPaginas}${missaoAutomatica ? ` | Missão automática: ${missaoAutomatica}` : ""}`,
      })
      .setColor(0x2b2d31);
  },

  gerarBotoes(pagina, level, questAtiva) {
    const totalPaginas = quests.quests.length;
    const quest = quests.quests[pagina];

    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`missao2:voltar`)
        .setLabel("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina === 0),
      new ButtonBuilder()
        .setCustomId(`missao2:aceitar`)
        .setLabel("📝 Aceitar")
        .setStyle(ButtonStyle.Success)
        .setDisabled(level < quest.nivel || Boolean(questAtiva)),
      new ButtonBuilder()
        .setCustomId(`missao2:avancar`)
        .setLabel("➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina === totalPaginas - 1),
      new ButtonBuilder()
        .setCustomId(`missao2:auto`)
        .setLabel("⚙️ Automático")
        .setStyle(ButtonStyle.Primary)
    );
  },
};