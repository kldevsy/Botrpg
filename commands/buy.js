const { EmbedBuilder } = require("discord.js");
const loja = require("../loja.json");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = {
  name: "buy",
  aliases: ["comprar"],
  description: "Compra um item da loja com berries.",
  async execute(message, args) {
    const [categoria, idxStr, qtdStr] = args;
    const index = parseInt(idxStr) - 1;
    const quantidade = parseInt(qtdStr) || 1;

    if (!categoria || isNaN(index) || index < 0 || quantidade <= 0) {
      return message.reply("❌ Uso correto: `!buy [categoria] [número] [quantidade]`");
    }

    const itens = loja[categoria.toLowerCase()];
    if (!itens || !itens[index]) {
      return message.reply("❌ Item não encontrado nesta categoria.");
    }

    const item = itens[index];
    const precoTotal = item.preco * quantidade;
    const userId = message.author.id;

    const berries = await db.get(`berries_${userId}`) || 0;

    if (berries < precoTotal) {
      return message.reply(`❌ Você precisa de **${precoTotal} berries**, mas tem apenas **${berries}**.`);
    }

    await db.sub(`berries_${userId}`, precoTotal);
    await db.add(`${item.id}_${userId}`, quantidade);

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("✅ Compra realizada!")
      .setDescription(`Você comprou **${quantidade}x ${item.nome}** por **${precoTotal} berries**.`)
      .setFooter({ text: `Use !inv para ver seu inventário.` });

    await message.reply({ embeds: [embed] });
  }
};