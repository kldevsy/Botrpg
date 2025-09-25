const { EmbedBuilder, Collection } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const loja = require("../loja.json");

const cooldowns = new Collection();

module.exports = {
  name: "usarbuff",
  aliases: ["usarbuffs"],
  async execute(message, args) {
    const userId = message.author.id;

    if (cooldowns.has(userId)) {
      return message.reply("⏳ | Espere 15 segundos antes de usar outro item.");
    }

    const buffs = [];
    const categoriasBuff = ["buffxp", "buffxpfruta", "buffberries"];

    for (const categoria of categoriasBuff) {
      for (const item of loja[categoria]) {
        const id = item.id;
        const quantidade = (await db.get(`${id}_${userId}`)) || 0;
        if (quantidade > 0) {
          buffs.push({
            ...item,
            categoria,
            quantidade
          });
        }
      }
    }

    if (buffs.length === 0) {
      return message.reply("❌ | Você não possui poções de buff temporário no inventário.");
    }

    const embed = new EmbedBuilder()
      .setTitle("🧪 Poções de Buff disponíveis")
      .setDescription(
        buffs.map((item, i) =>
          `**${i + 1}. ${item.nome}** (${item.quantidade}x)\n` +
          `🌀 Efeito: ${item.descricao}\n🔺 Aumento: ${item.aumento}x | ⏱️ 30min`
        ).join("\n\n")
      )
      .setColor("#9b59b6");

    await message.reply({ embeds: [embed] });

    const filter = m => m.author.id === userId;
    try {
      const respostas = await message.channel.awaitMessages({
        filter,
        max: 1,
        time: 30000,
        errors: ["time"]
      });

      const index = parseInt(respostas.first().content);

      if (isNaN(index) || index < 1 || index > buffs.length) {
        return message.reply("❌ | Número inválido. Use o comando novamente.");
      }

      cooldowns.set(userId, true);
      setTimeout(() => cooldowns.delete(userId), 15000);

      const escolhido = buffs[index - 1];
      const key =
        escolhido.categoria === "buffxpfruta"
          ? `buffxpfruta_${userId}`
          : escolhido.categoria === "buffberries"
            ? `buffberries_${userId}`
            : `buffxp_${userId}`;

      const expira = Date.now() + 30 * 60 * 1000; // 30 minutos

      // Aplica o buff
      await db.set(key, {
        aumento: parseFloat(escolhido.aumento),
        expira
      });

      // Remove do inventário
      await db.set(`${escolhido.id}_${userId}`, escolhido.quantidade - 1);

      const embedBuff = new EmbedBuilder()
        .setTitle("✨ Buff Ativado!")
        .setDescription(
          `Você usou **${escolhido.nome}**.\n\n` +
          `🔺 **Aumento:** \`${escolhido.aumento}x\`\n` +
          `⏱️ **Duração:** \`30 minutos\``
        )
        .setColor("#f1c40f");

      return message.reply({ embeds: [embedBuff] });
    } catch (err) {
      return message.reply("⏳ | Tempo esgotado. Use o comando novamente.");
    }
  }
};