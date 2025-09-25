// Blackjack 21 com economia e botões - Adaptado ao seu sistema
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

const cartas = [
  { nome: "A", valor: 11 },
  { nome: "2", valor: 2 }, { nome: "3", valor: 3 }, { nome: "4", valor: 4 },
  { nome: "5", valor: 5 }, { nome: "6", valor: 6 }, { nome: "7", valor: 7 },
  { nome: "8", valor: 8 }, { nome: "9", valor: 9 }, { nome: "10", valor: 10 },
  { nome: "J", valor: 10 }, { nome: "Q", valor: 10 }, { nome: "K", valor: 10 }
];

function comprarCarta() {
  return cartas[Math.floor(Math.random() * cartas.length)];
}

function calcularTotal(mao) {
  let total = mao.reduce((acc, c) => acc + c.valor, 0);
  let ases = mao.filter(c => c.nome === "A").length;
  while (total > 21 && ases--) total -= 10;
  return total;
}

module.exports = {
  name: "blackjack",
  description: "Jogue blackjack apostando berries.",
  async execute(message, args, client) {
    const userId = message.author.id;
    const aposta = parseInt(args[0]);
    const saldo = await db.get(`berries_${userId}`) || 0;

    if (!aposta || isNaN(aposta) || aposta <= 0) return message.reply("❌ Informe um valor válido para apostar.");
    if (aposta > saldo) return message.reply("❌ Você não tem berries suficientes.");

    await db.sub(`berries_${userId}`, aposta);

    const maoJogador = [comprarCarta(), comprarCarta()];
    const maoDealer = [comprarCarta()];

    const embed = new EmbedBuilder()
      .setTitle(`🃏 Blackjack - ${message.author.username}`)
      .setDescription(`**Suas cartas:** ${maoJogador.map(c => c.nome).join(", ")} (**${calcularTotal(maoJogador)}**)
**Dealer:** ${maoDealer[0].nome}, ?`)
      .setColor("Green")
      .setFooter({ text: `Aposta: ${aposta.toLocaleString()} berries` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`blackjack:hit:${aposta}`).setLabel("Pedir Carta").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`blackjack:stand:${aposta}`).setLabel("Parar").setStyle(ButtonStyle.Secondary)
    );

    await db.set(`bj_jogador_${userId}`, maoJogador);
    await db.set(`bj_dealer_${userId}`, maoDealer);
    await db.set(`bj_aposta_${userId}`, aposta);

    message.reply({ embeds: [embed], components: [row] });
  },

  async button(interaction, { action, rest }) {
    const userId = interaction.user.id;
    const maoJogador = await db.get(`bj_jogador_${userId}`);
    const maoDealer = await db.get(`bj_dealer_${userId}`);
    const aposta = await db.get(`bj_aposta_${userId}`);

    if (!maoJogador || !maoDealer) return interaction.reply({ content: "❌ Jogo expirado ou não encontrado.", ephemeral: true });

    if (action === "hit") {
      maoJogador.push(comprarCarta());
      const total = calcularTotal(maoJogador);

      if (total > 21) {
        await db.delete(`bj_jogador_${userId}`);
        await db.delete(`bj_dealer_${userId}`);
        await db.delete(`bj_aposta_${userId}`);
        return interaction.update({
          embeds: [new EmbedBuilder()
            .setTitle("💥 Você perdeu!")
            .setDescription(`Estourou com ${total} pontos!
Cartas: ${maoJogador.map(c => c.nome).join(", ")}`)
            .setColor("Red")],
          components: []
        });
      } else {
        return interaction.update({
          embeds: [new EmbedBuilder()
            .setTitle("🃏 Blackjack")
            .setDescription(`**Suas cartas:** ${maoJogador.map(c => c.nome).join(", ")} (**${total}**)
**Dealer:** ${maoDealer[0].nome}, ?`)
            .setColor("Green")],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`blackjack:hit:${aposta}`).setLabel("Pedir Carta").setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId(`blackjack:stand:${aposta}`).setLabel("Parar").setStyle(ButtonStyle.Secondary)
            )
          ]
        });
      }
    }

    if (action === "stand") {
      // Dealer joga
      while (calcularTotal(maoDealer) < 17) maoDealer.push(comprarCarta());

      const totalJogador = calcularTotal(maoJogador);
      const totalDealer = calcularTotal(maoDealer);

      let resultado = "";
      let cor = "Grey";

      if (totalDealer > 21 || totalJogador > totalDealer) {
        resultado = `🎉 Você ganhou! Recebeu ${aposta * 2} berries.`;
        cor = "Green";
        await db.add(`berries_${userId}`, aposta * 2);
      } else if (totalJogador === totalDealer) {
        resultado = `🤝 Empate! Você recebeu ${aposta} berries de volta.`;
        cor = "Yellow";
        await db.add(`berries_${userId}`, aposta);
      } else {
        resultado = `💥 Dealer venceu com ${totalDealer} pontos.`;
        cor = "Red";
      }

      await db.delete(`bj_jogador_${userId}`);
      await db.delete(`bj_dealer_${userId}`);
      await db.delete(`bj_aposta_${userId}`);

      return interaction.update({
        embeds: [new EmbedBuilder()
          .setTitle("🎲 Resultado do Blackjack")
          .setDescription(`**Suas cartas:** ${maoJogador.map(c => c.nome).join(", ")} (${totalJogador})
**Dealer:** ${maoDealer.map(c => c.nome).join(", ")} (${totalDealer})

${resultado}`)
          .setColor(cor)],
        components: []
      });
    }
  }
};
