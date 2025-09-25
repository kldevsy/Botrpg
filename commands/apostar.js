const { QuickDB } = require("quick.db");
const db = new QuickDB();
const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "apostar",
  description: "Aposte na roleta!",
  aliases: [],
  async execute(message, args) {
    const userId = message.author.id;

    let rodada = (await db.get("roleta_rodada")) || {
      apostas: [],
      encerrada: false,
      tempo: Date.now() + 5 * 60 * 1000
    };

    if (rodada.encerrada) {
      return message.reply("❌ Apostas estão encerradas! Aguarde a próxima rodada.");
    }

    if (!args.length) {
      

const embederro = new EmbedBuilder()
  .setColor("Red")
  .setTitle("❌ Erro ao Apostar")
  .setDescription("Formato inválido! Confira as instruções abaixo para apostar corretamente:")
  .addFields(
    {
      name: "📌 Formatos válidos",
      value:
        "`!apostar [cor] [número(opcional)] [valor]`\n" +
        "`!apostar [número] [valor]`\n" +
        "`!apostar [cor] [valor]`",
    },
    {
      name: "🎯 Cores disponíveis",
      value:
        "`vermelho` ou `🟥`\n" +
        "`preto` ou `⬛`\n" +
        "`branco` ou `⬜`",
      inline: true,
    },
    {
      name: "💸 Exemplos de uso",
      value:
        "`!apostar vermelho 25 10k` → cor + número + valor\n" +
        "`!apostar 33 1.2kk` → número + valor\n" +
        "`!apostar preto 500` → cor + valor",
    },
    {
      name: "📊 Sufixos aceitos",
      value:
        "`k` = mil → `10k` = 10.000\n" +
        "`kk` = milhão → `1.2kk` = 1.200.000\n" +
        "`m` ou `milhão` = milhão\n" +
        "`mil` = mil\n" +
        "`b` ou `bilhão` = bilhão",
    }
  )
  .setFooter({ text: "Use um valor numérico válido para apostar!" })
  .setTimestamp();

return message.reply({ embeds: [embederro] });
     // return message.reply("❌ Use: `!apostar [cor] [número(opcional)] [valor]` ou `!apostar [número] [valor]` ou `!apostar [cor] [valor]`");
    }

    let cor = null;
    let numero = null;
    let valor = null;

    const coresValidas = ["vermelho", "preto", "branco", "🟥", "⬛", "⬜"];
    const corMap = {
      "vermelho": "🟥",
      "preto": "⬛",
      "branco": "⬜",
      "🟥": "🟥",
      "⬛": "⬛",
      "⬜": "⬜",
    };

    function converterValor(str) {
      str = str.toLowerCase().replace(",", ".").replace(/\s/g, "");
      str = str.replace(/milhao|milhões/g, "m").replace(/mil/g, "k").replace(/kk/g, "m");

      if (!isNaN(str)) return parseFloat(str);

      const match = str.match(/^(\d+(\.\d+)?)([kmb])$/i);
      if (!match) return NaN;

      const numero = parseFloat(match[1]);
      const sufixo = match[3];

      switch (sufixo) {
        case "k": return Math.round(numero * 1_000);
        case "m": return Math.round(numero * 1_000_000);
        case "b": return Math.round(numero * 1_000_000_000);
        default: return NaN;
      }
    }

    // Primeira varredura: detectar cor
    for (const arg of args) {
      const argLower = arg.toLowerCase();
      if (coresValidas.includes(argLower)) {
        cor = corMap[argLower];
        break;
      }
    }

    // Segunda varredura: detectar número entre 0 e 100
    for (const arg of args) {
      const n = parseInt(arg);
      if (!isNaN(n) && n >= 0 && n <= 100) {
        numero = n;
        break;
      }
    }

    // Terceira varredura: detectar valor de aposta com sufixo
    for (const arg of args) {
      const convertido = converterValor(arg);
      if (!isNaN(convertido) && convertido > 0) {
        valor = convertido;
        break;
      }
    }

    console.log("🪙 Valor interpretado:", valor);

    if (!valor || valor <= 0) {
      return message.reply("❌ Valor de aposta inválido.");
    }

    const saldo = await db.get(`berries_${userId}`) || 0;
    if (valor > saldo) {
      return message.reply("❌ Você não tem berries suficientes.");
    }

    await db.sub(`berries_${userId}`, valor);

    rodada.apostas.push({
      userId,
      nome: message.author.username,
      cor,
      numero,
      valor,
    });

    await db.set("roleta_rodada", rodada);

    return message.reply(`✅ Aposta registrada: ${cor || "sem cor"} ${numero !== null ? `número ${numero}` : "sem número"} - 💸 ${valor.toLocaleString()} berries`);
  },
};