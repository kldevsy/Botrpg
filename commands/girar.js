const { QuickDB } = require("quick.db");
const db = new QuickDB();

const {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const frutasJson = require("../frutas.json");

module.exports = {
  name: "girar",
  aliases: ["spinfruta"],

  async execute(message) {
    try {
      const userId = message.author.id;

      const criado = await db.get(`criado_${userId}`);
      if (!criado) {
        return message.channel.send("❌ Você ainda não criou seu personagem! Use `!iniciar`.");
      }

      const nivel = (await db.get(`nivel_${userId}`)) || 1;
      const custo = 100 + nivel * 75;
      const berries = (await db.get(`berries_${userId}`)) || 0;
      const inventario = (await db.get(`frutas_inventario_${userId}`)) || [];
      const slots = (await db.get(`slots_fruta_${userId}`)) || 30;

      const lastSpin = (await db.get(`lastFruitSpin_${userId}`)) || 0;
      const now = Date.now();
      const cooldown = 60 * 60 * 1000;
      const tempoRestanteMs = cooldown - (now - lastSpin);
      const tempoRestanteMin = tempoRestanteMs > 0 ? Math.ceil(tempoRestanteMs / 60000) : 0;

      const embedInfo = new EmbedBuilder()
        .setTitle("🍀 Gire a Roleta de Frutas!")
        .setDescription("Veja as chances, custo e condições antes de girar.")
        .addFields(
          { name: "🎯 Preço do Giro", value: `${custo} berries`, inline: true },
          {
            name: "🕐 Cooldown",
            value: tempoRestanteMin > 0 ? `${tempoRestanteMin} minuto(s)` : "Pronto para girar!",
            inline: true,
          },
          {
            name: "📦 Inventário",
            value: `${inventario.length}/${slots} slots usados`,
            inline: true,
          },
          {
            name: "🍇 Frutas Disponíveis",
            value: frutasJson.frutas.map(f => `**${f.nome}** (${f.raridade}) - ${f.chance}%`).join("\n")
          }
        )
        .setColor("#00b894")
        .setFooter({ text: "Clique no botão abaixo para girar!" });

      const btnGirar = new ButtonBuilder()
        .setCustomId(`girar:confirmar:${userId}`)
        .setLabel("🎯 Girar")
        .setStyle(ButtonStyle.Success)
        .setDisabled(tempoRestanteMin > 0 || berries < custo || inventario.length >= slots);

      const row = new ActionRowBuilder().addComponents(btnGirar);

      await message.channel.send({ embeds: [embedInfo], components: [row] });
    } catch (error) {
      console.error("Erro no comando girar:", error);
      message.channel.send("❌ Ocorreu um erro ao executar o comando.");
    }
  },

  async button(interaction) {
    const customId = interaction.customId;

    // 🎯 Confirmar giro
    if (customId.startsWith("girar:confirmar:")) {
      try {
        const [, , targetId] = customId.split(":");
        const userId = interaction.user.id;
        const now = Date.now();

        if (userId !== targetId) {
          return interaction.reply({ content: "❌ Este botão não é para você.", ephemeral: true });
        }

        const nivel = (await db.get(`nivel_${userId}`)) || 1;
        const custo = 100 + nivel * 75;
        const berries = (await db.get(`berries_${userId}`)) || 0;
        const inventario = (await db.get(`frutas_inventario_${userId}`)) || [];
        const slots = (await db.get(`slots_fruta_${userId}`)) || 30;

        const lastSpin = (await db.get(`lastFruitSpin_${userId}`)) || 0;
        const cooldown = 60 * 60 * 1000;
        const tempoRestanteMs = cooldown - (now - lastSpin);
        if (tempoRestanteMs > 0) {
          const tempoMin = Math.ceil(tempoRestanteMs / 60000);
          return interaction.reply({
            content: `⏳ Aguarde **${tempoMin} minuto(s)** para girar novamente.`,
            ephemeral: true,
          });
        }

        if (berries < custo) {
          return interaction.reply({
            content: `💸 Você precisa de **${custo} berries** para girar. Você tem ${berries}.`,
            ephemeral: true,
          });
        }

        // Subtrai berries e marca o tempo do último giro
        await db.sub(`berries_${userId}`, custo);
        await db.set(`lastFruitSpin_${userId}`, now);

        const frutas = frutasJson.frutas;
        const totalChance = frutas.reduce((acc, f) => acc + f.chance, 0);
        const random = Math.random() * totalChance;

        let acumulado = 0;
        let frutaObtida = frutas[0];
        for (const fruta of frutas) {
          acumulado += fruta.chance;
          if (random <= acumulado) {
            frutaObtida = fruta;
            break;
          }
        }

        const animEmbed = new EmbedBuilder()
          .setTitle("🎲 Girando a Roleta...")
          .setDescription("🌀 A roleta está girando...\n🎁 Qual fruta aparecerá?")
          .setColor("#f1c40f")
          .setFooter({ text: "Segure-se! Está quase!" });

        await interaction.reply({ embeds: [animEmbed], ephemeral: true });

        setTimeout(async () => {
          if (inventario.length >= slots) {
            const embedDrop = new EmbedBuilder()
              .setTitle("🍇 Uma fruta foi largada no chão!")
              .setDescription(`**${frutaObtida.nome}** (${frutaObtida.raridade}) apareceu!\nClique no botão abaixo em até **2 minutos** para resgatá-la.`)
              .setColor("#9b59b6");

            const btnResgatar = new ButtonBuilder()
              .setCustomId(`girar:resgatar`)
              .setLabel("🍇 Resgatar")
              .setStyle(ButtonStyle.Primary);

            const rowDrop = new ActionRowBuilder().addComponents(btnResgatar);

            const dropMsg = await interaction.channel.send({
              embeds: [embedDrop],
              components: [rowDrop],
            });

            let frutaEntregue = false;

            const coletorDrop = dropMsg.createMessageComponentCollector({
              componentType: ComponentType.Button,
              time: 2 * 60 * 1000,
            });

            coletorDrop.on("collect", async (btnInt) => {
              const alvoId = btnInt.user.id;
              const invAlvo = (await db.get(`frutas_inventario_${alvoId}`)) || [];
              const slotsAlvo = (await db.get(`slots_fruta_${alvoId}`)) || 1;

              if (frutaEntregue) {
                return btnInt.reply({ content: "⚠️ Esta fruta já foi resgatada.", ephemeral: true });
              }

              if (invAlvo.length < slotsAlvo) {
                await db.set(`frutas_inventario_${alvoId}`, [...invAlvo, frutaObtida]);
                frutaEntregue = true;

                await btnInt.reply({
                  content: `🎉 **${btnInt.user.username}** pegou a fruta **${frutaObtida.nome}**!`,
                });

                await dropMsg.edit({ components: [] });
                coletorDrop.stop();
              } else {
                await btnInt.reply({ content: "⚠️ Você não tem espaço para mais frutas.", ephemeral: true });
              }
            });

            coletorDrop.on("end", async () => {
              if (!frutaEntregue) {
                const embedFim = new EmbedBuilder()
                  .setTitle("🌊 A fruta foi levada pelo mar...")
                  .setColor("#95a5a6");
                await dropMsg.edit({ embeds: [embedFim], components: [] });
              }
            });

            return;
          }

          await db.set(`frutas_inventario_${userId}`, [...inventario, frutaObtida]);

          // Garante que os campos são strings válidas
          const nomeFruta = frutaObtida.nome ? String(frutaObtida.nome) : "Nome desconhecido";
          const raridadeFruta = frutaObtida.raridade ? String(frutaObtida.raridade) : "Raridade desconhecida";
          const habilidadeFruta = frutaObtida.habilidade ? String(frutaObtida.habilidade) : "Nenhuma habilidade especial";

          console.log("Fruta obtida no giro:", frutaObtida);

          const embedResultado = new EmbedBuilder()
            .setTitle("🎁 Você girou e conseguiu uma fruta!")
            .addFields(
              { name: "Fruta", value: nomeFruta, inline: true },
              { name: "Raridade", value: raridadeFruta, inline: true },
              { name: "Habilidade", value: habilidadeFruta, inline: false }
            )
            .setColor("#f39c12")
            .setFooter({ text: "Use !fruta para ver ou !comerfruta para equipar." });

          await interaction.followUp({ embeds: [embedResultado], ephemeral: true });
        }, 2500);

        return true;
      } catch (error) {
        console.error("Erro no botão girar:", error);
        if (!interaction.replied) {
          await interaction.reply({
            content: "❌ Ocorreu um erro ao processar o giro.",
            ephemeral: true,
          });
        }
        return true;
      }
    }

    return false;
  },
};