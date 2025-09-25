const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

const MAX_PONTOS_TOTAL = 150;
function custoPorPontoAtual(ponto) {
  return 10 + ponto * 2;
}
function barra(valor) {
  const total = 20;
  const preenchido = Math.min(valor, total);
  const vazio = total - preenchido;
  return "▰".repeat(preenchido) + "▱".repeat(vazio);
}
module.exports = {
  name: "up2",
  aliases: [],
  description: "Abra o menu de upgrade de status.",
  async execute(message) {
    const userId = message.author.id;

    const criado = await db.get(`criado_${userId}`);
    if (!criado) return message.reply("❌ Você ainda não criou seu personagem. Use `!iniciar`.");
const nome = await db.get(`nome_${userId}`);
    let xp = await db.get(`xp_${userId}`) || 0;

    let forca = await db.get(`status_forca_${userId}`) || 0;
    let defesa = await db.get(`status_defesa_${userId}`) || 0;
    let agilidade = await db.get(`status_agilidade_${userId}`) || 0;
    let inteligencia = await db.get(`status_inteligencia_${userId}`) || 0;
    let estamina = await db.get(`status_estamina_${userId}`) || 0;
    let vidamax = await db.get(`vidamax_${userId}`) || 100;

    
    
    const total = forca + defesa + agilidade + inteligencia + estamina;

const embed = new EmbedBuilder()
  .setTitle(`📊 Status de ${nome}`)
  .setColor("#00b0f4")
  .setDescription(
    `**XP disponível:** ${xp}\n` +
    `**Pontos usados:** ${total}/${MAX_PONTOS_TOTAL}\n\n` +
    `💪 Força: ${forca} ${barra(forca)}\n` +
    `🛡️ Defesa: ${defesa} ${barra(defesa)}\n` +
    `⚡ Agilidade: ${agilidade} ${barra(agilidade)}\n` +
    `🧠 Inteligência: ${inteligencia} ${barra(inteligencia)}\n` +
    `🔥 Estamina: ${estamina} ${barra(estamina)}\n` +
    `❤️ Vida Máxima: ${vidamax}`
  );

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("up:choose:forca").setLabel("Força").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("up:choose:defesa").setLabel("Defesa").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("up:choose:agilidade").setLabel("Agilidade").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("up:choose:inteligencia").setLabel("Inteligência").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("up:choose:estamina").setLabel("Estamina").setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("up:resetmenu:open").setLabel("🔁 Resetar Status").setStyle(ButtonStyle.Danger)
    );

    return message.reply({ embeds: [embed], components: [row1, row2] });
  },

  async button(interaction) {
    const [comando, acao, dado] = interaction.customId.split(":");
    const userId = interaction.user.id;

    if (comando !== "up") return;

    const nome = await db.get(`nome_${userId}`);
    let xp = await db.get(`xp_${userId}`) || 0;

    let forca = await db.get(`status_forca_${userId}`) || 0;
    let defesa = await db.get(`status_defesa_${userId}`) || 0;
    let agilidade = await db.get(`status_agilidade_${userId}`) || 0;
    let inteligencia = await db.get(`status_inteligencia_${userId}`) || 0;
    let estamina = await db.get(`status_estamina_${userId}`) || 0;
    let vidamax = await db.get(`vidamax_${userId}`) || 100;

    const total = forca + defesa + agilidade + inteligencia + estamina;

    if (acao === "choose") {
      const embed = new EmbedBuilder()
        .setTitle(`📈 Upar ${dado}`)
        .setDescription(`Quantos pontos deseja adicionar a **${dado}**?`)
        .setColor("Green");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`up:confirm:${dado}:1`).setLabel("+1").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`up:confirm:${dado}:5`).setLabel("+5").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`up:confirm:${dado}:10`).setLabel("+10").setStyle(ButtonStyle.Success)
      );

      return interaction.reply({ ephemeral: true, embeds: [embed], components: [row] });
    }

    if (acao === "confirm") {
      const [status, qtdStr] = dado.split(":");
      const quantidade = parseInt(qtdStr);
      const atual = { forca, defesa, agilidade, inteligencia, estamina }[status];
      const novoTotal = total + quantidade;

      if (novoTotal > MAX_PONTOS_TOTAL)
        return interaction.reply({ content: `❌ Você só pode usar até ${MAX_PONTOS_TOTAL} pontos no total.`, ephemeral: true });

      let custoTotal = 0;
      for (let i = 0; i < quantidade; i++) {
        custoTotal += custoPorPontoAtual(atual + i);
      }

      if (xp < custoTotal)
        return interaction.reply({ content: `❌ XP insuficiente! Precisa de ${custoTotal}, mas você tem ${xp}.`, ephemeral: true });

      await db.set(`status_${status}_${userId}`, atual + quantidade);
      await db.set(`xp_${userId}`, xp - custoTotal);

      if (status === "defesa") {
        vidamax += 35 * quantidade;
        await db.set(`vidamax_${userId}`, vidamax);
      }

      return interaction.reply({
        ephemeral: true,
        content: `✅ Você upou **${quantidade} ponto(s)** em **${status}** por **${custoTotal} XP**!`
      });
    }

    if (acao === "resetmenu" && dado === "open") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("up:reset:forca").setLabel("Força").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("up:reset:defesa").setLabel("Defesa").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("up:reset:agilidade").setLabel("Agilidade").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("up:reset:inteligencia").setLabel("Inteligência").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("up:reset:estamina").setLabel("Estamina").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("up:reset:all").setLabel("🔁 Resetar Tudo").setStyle(ButtonStyle.Danger)
      );
      return interaction.reply({ ephemeral: true, content: "Escolha o status que deseja resetar:", components: [row] });
    }

    if (acao === "reset") {
      const status = dado;
      let xpDevolvido = 0;
      const pontos = {
        forca, defesa, agilidade, inteligencia, estamina
      };

      if (status === "all") {
        for (const key in pontos) {
          for (let i = 0; i < pontos[key]; i++) xpDevolvido += custoPorPontoAtual(i);
          await db.set(`status_${key}_${userId}`, 0);
        }
        await db.set(`vidamax_${userId}`, 100);
      } else {
        if (pontos[status] === 0) {
          return interaction.reply({ content: `❌ Você não tem pontos em ${status} para resetar.`, ephemeral: true });
        }

        for (let i = 0; i < pontos[status]; i++) xpDevolvido += custoPorPontoAtual(i);
        await db.set(`status_${status}_${userId}`, 0);
        if (status === "defesa") {
          vidamax -= pontos[status] * 35;
          if (vidamax < 100) vidamax = 100;
          await db.set(`vidamax_${userId}`, vidamax);
        }
      }

      xpDevolvido = Math.floor(xpDevolvido * 0.9);
      await db.set(`xp_${userId}`, xp + xpDevolvido);

      return interaction.reply({ content: `✅ Reset concluído! Você recuperou **${xpDevolvido} XP**.`, ephemeral: true });
    }
  }
};