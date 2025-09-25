const { EmbedBuilder } = require("discord.js");
const loja = require("../loja.json");

module.exports = {
  name: "store",
  aliases: ["loja"],
  description: "Exibe os itens disponíveis em uma categoria da loja.",
  async execute(message, args) {
    const categoria = args[0]?.toLowerCase();

    if (!categoria || !Array.isArray(loja[categoria])) {
      return message.reply("❌ Categoria inválida. Ex: `cura`, `stamina`, `buffxp`, `buffxpfruta`, `buffberries`");
    }

    if (loja[categoria].length === 0) {
      return message.reply("⚠️ Nenhum item disponível nesta categoria.");
    }

    const embed = new EmbedBuilder()
      .setColor("#00ff99")
      .setTitle(`🛒 Loja: ${categoria.toUpperCase()}`)
      .setDescription(
        loja[categoria].map((item, i) =>
          `**${i + 1}. ${item.nome}**\n${item.descricao}\n💰 **Preço:** ${item.preco} berries`
        ).join("\n\n")
      );

    await message.reply({ embeds: [embed] });
  }
};