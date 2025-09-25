const { QuickDB } = require('quick.db');
const db = new QuickDB();
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

module.exports = {
  name: "equiparitem",
  aliases: ["equipar"],
  description: "Equipe um equipamento pelo ID.",

  async execute(message, args) {
    const userId = message.author.id;

    const criado = await db.get(`criado_${userId}`);
    if (!criado) {
      return message.reply("❌ Você ainda não criou seu personagem! Use `!iniciar`.");
    }

    const itemId = args[0];
    if (!itemId) {
      return message.reply("❌ Digite o ID do equipamento que deseja equipar.");
    }

    const equipamentos = await db.get(`equipamentos_${userId}`) || [];
    const item = equipamentos.find(e => e.id === itemId);

    if (!item) {
      return message.reply("❌ Você não possui esse equipamento.");
    }

    const atual = await db.get(`equipamento_${userId}`);

    if (atual) {
      const bonusAtual = atual.bonus || {};
      const bonusNovo = item.bonus || {};
      const atributos = ["vida", "forca", "resistencia", "inteligencia", "xp", "berries"];

      const comparacao = atributos.map(attr => {
        const atualVal = bonusAtual[attr] || 0;
        const novoVal = bonusNovo[attr] || 0;
        const diff = novoVal - atualVal;
        const emoji = diff > 0 ? "➕" : diff < 0 ? "➖" : "➡️";
        const porcentagem = atualVal !== 0 ? ((diff / atualVal) * 100).toFixed(1) : (novoVal > 0 ? "100.0" : "0");
        return `**${attr}**: ${atualVal} ${emoji} ${novoVal} (${diff >= 0 ? "+" : ""}${porcentagem}%)`;
      }).join("\n");

      const embed = new EmbedBuilder()
        .setTitle("🔄 Substituir Equipamento?")
        .setColor("#3498db")
        .setDescription(`Você já possui **${atual.nome}** equipado.\nDeseja trocá-lo por **${item.nome}**?`)
        .addFields({ name: "📊 Comparação de Bônus", value: comparacao });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`equiparitem:confirmar:${item.id}`)
          .setLabel("✅ Equipar")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`equiparitem:cancelar`)
          .setLabel("❌ Cancelar")
          .setStyle(ButtonStyle.Danger)
      );

      await message.channel.send({ embeds: [embed], components: [row] });
    } else {
      await db.set(`equipamento_${userId}`, item);
      message.channel.send(`✅ **${item.nome}** foi equipado com sucesso!`);
    }
  },

  // ✅ Lógica para interações com botões
  async button(interaction) {
    const userId = interaction.user.id;
    const [cmd, acao, itemId] = interaction.customId.split(":");
    if (cmd !== "equiparitem") return;

    if (acao === "cancelar") {
      await interaction.update({ content: "❌ A troca de equipamento foi cancelada.", components: [], embeds: [] });
      return;
    }

    if (acao === "confirmar") {
      const equipamentos = await db.get(`equipamentos_${userId}`) || [];
      const item = equipamentos.find(e => e.id === itemId);

      if (!item) {
        return interaction.update({ content: "❌ Equipamento não encontrado no seu inventário.", components: [], embeds: [] });
      }

      await db.set(`equipamento_${userId}`, item);
      await interaction.update({ content: `✅ **${item.nome}** foi equipado com sucesso!`, components: [], embeds: [] });
    }
  }
};