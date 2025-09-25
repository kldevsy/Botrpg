const { EmbedBuilder } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const loja = require("../loja.json");

const cooldowns = new Map();

module.exports = {
  name: "usar",
  aliases: ["usaritem", "usarpoção"],
  async execute(message, args) {
    const userId = message.author.id;
    const itemId = args[0]?.toLowerCase();

    const now = Date.now();
    const cooldownAmount = 15000;

    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId);
      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff5555")
              .setTitle("⏳ Aguarde um momento!")
              .setDescription(`Você deve esperar **${timeLeft}s** antes de usar outro item.`)
          ]
        });
      }
    }

    cooldowns.set(userId, now + cooldownAmount);
    setTimeout(() => cooldowns.delete(userId), cooldownAmount);

    if (!itemId) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff5555")
            .setTitle("❌ Uso incorreto!")
            .setDescription("Utilize: `!usar [itemID]`")
        ]
      });
    }

    const item =
      loja.cura.find(p => p.id === itemId) ||
      loja.stamina.find(p => p.id === itemId);

    if (!item) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff5555")
            .setTitle("❌ Item inválido!")
            .setDescription("Esse item não existe ou não pode ser usado.")
        ]
      });
    }

    const quantidade = (await db.get(`${item.id}_${userId}`)) || 0;
    if (quantidade < 1) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff5555")
            .setTitle("📦 Sem itens!")
            .setDescription("Você não possui esse item no inventário.")
        ]
      });
    }

    let vida = (await db.get(`vida_${userId}`)) || 0;
    const vidaMax = (await db.get(`vidamax_${userId}`)) || 100;
    let stamina = (await db.get(`stamina_${userId}`)) || 0;
    const staminaMax = (await db.get(`staminamax_${userId}`)) || 100;

    let resultado = "";
    let tipo = "";

    if (
      itemId.includes("cura") ||
      item.nome.toLowerCase().includes("vida") ||
      item.nome.toLowerCase().includes("carne")
    ) {
      if (vida >= vidaMax) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ffaa00")
              .setTitle("❤️ Vida cheia!")
              .setDescription("Sua vida já está no máximo.")
          ]
        });
      }

      tipo = "vida";
      if (item.nome.includes("50%")) {
        const curado = Math.floor(vidaMax * 0.5);
        vida = Math.min(vida + curado, vidaMax);
        resultado = `❤️ Você recuperou **${curado}** de vida!`;
      } else if (item.nome.includes("100%") || item.nome.toLowerCase().includes("carne")) {
        vida = vidaMax;
        resultado = `❤️ Sua vida foi **totalmente restaurada**!`;
      } else {
        const curado = item.efeito;
        vida = Math.min(vida + curado, vidaMax);
        resultado = `❤️ Você recuperou **${curado}** de vida!`;
      }

      await db.set(`vida_${userId}`, vida);
    } else if (
      itemId.includes("energia") ||
      item.nome.toLowerCase().includes("stamina") ||
      item.nome.toLowerCase().includes("saquê")
    ) {
      if (stamina >= staminaMax) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ffaa00")
              .setTitle("⚡ Stamina cheia!")
              .setDescription("Sua stamina já está no máximo.")
          ]
        });
      }

      tipo = "stamina";
      if (item.nome.includes("50%")) {
        const recuperado = Math.floor(staminaMax * 0.5);
        stamina = Math.min(stamina + recuperado, staminaMax);
        resultado = `⚡ Você recuperou **${recuperado}** de stamina!`;
      } else if (item.nome.includes("100%") || item.nome.toLowerCase().includes("saquê")) {
        stamina = staminaMax;
        resultado = `⚡ Sua stamina foi **totalmente restaurada**!`;
      } else {
        const recuperado = item.efeito;
        stamina = Math.min(stamina + recuperado, staminaMax);
        resultado = `⚡ Você recuperou **${recuperado}** de stamina!`;
      }

      await db.set(`stamina_${userId}`, stamina);
    }

    await db.set(`${item.id}_${userId}`, quantidade - 1);

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#00ff99")
          .setTitle(`✅ ${item.nome} usado com sucesso!`)
          .setDescription(resultado)
      ]
    });
  }
};