const { EmbedBuilder } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = {
  name: "setbuff",
  aliases: ["aplicarbuff"],
  async execute(message, args) {
    const devs = ["797713122084388866"];
    if (!devs.includes(message.author.id)) return;

    const [tipo, categoria, aumentoStr, duracaoStr, ...alvos] = args;
    if (!tipo || !categoria || !aumentoStr || duracaoStr === undefined) {
      return message.reply("❌ Uso correto: `!setbuff [usuario/guilda/evento/permanente] [xp/xpfruta/berries] [aumento] [duração] [@menções/IDs...]`");
    }

    const tiposValidos = ["usuario", "guilda", "evento", "permanente"];
    const categoriasValidas = ["xp", "xpfruta", "berries"];

    if (!tiposValidos.includes(tipo)) return message.reply("❌ Tipo inválido. Use: `usuario`, `guilda`, `evento`, `permanente`.");
    if (!categoriasValidas.includes(categoria)) return message.reply("❌ Categoria inválida. Use: `xp`, `xpfruta`, `berries`.");

    const aumento = parseFloat(aumentoStr);
    const duracao = parseInt(duracaoStr);

    if (isNaN(aumento) || aumento < 0) return message.reply("❌ Aumento inválido. Use 0 ou mais.");
    if (isNaN(duracao) || duracao < 0) return message.reply("❌ Duração inválida.");

    const prefixos = {
      usuario: {
        xp: "buffxp_",
        xpfruta: "buffxpfruta_",
        berries: "buffberries_"
      },
      guilda: {
        xp: "guildbuffxp_",
        xpfruta: "guildbuffxpfruta_",
        berries: "guildbuffberries_"
      },
      evento: {
        xp: "eventbuffxp",
        xpfruta: "eventbuffxpfruta",
        berries: "eventbuffberries"
      },
      permanente: {
        xp: "permabuffxp_",
        xpfruta: "permabuffxpfruta_",
        berries: "permabuffberries_"
      }
    };

    const prefixoChave = prefixos[tipo][categoria];
    const alvoUsuarios = [];

    if (tipo === "usuario" || tipo === "permanente") {
      const mencionados = message.mentions.users.map(u => u.id);
      const idsDiretos = alvos.filter(arg => /^\d{17,20}$/.test(arg));
      alvoUsuarios.push(...new Set([...mencionados, ...idsDiretos]));
    }

    const removerBuff = async (chave) => await db.delete(chave);
    const aplicarBuff = async (chave, data) => await db.set(chave, data);

    if (aumento === 0) {
      if (tipo === "evento") {
        await removerBuff(prefixoChave);
      } else if (tipo === "guilda") {
        await removerBuff(`${prefixoChave}${message.guild.id}`);
      } else if (alvoUsuarios.length > 0) {
        for (const userId of alvoUsuarios) {
          await removerBuff(`${prefixoChave}${userId}`);
        }
      } else {
        await removerBuff(`${prefixoChave}${message.author.id}`);
        alvoUsuarios.push(message.author.id);
      }
    } else {
      const buffData = { aumento: parseFloat(aumento.toFixed(2)) };
      if (duracao > 0) buffData.expira = Date.now() + duracao * 60000;

      if (tipo === "evento") {
        await aplicarBuff(prefixoChave, buffData);
      } else if (tipo === "guilda") {
        await aplicarBuff(`${prefixoChave}${message.guild.id}`, buffData);
      } else if (alvoUsuarios.length > 0) {
        for (const userId of alvoUsuarios) {
          await aplicarBuff(`${prefixoChave}${userId}`, buffData);
        }
      } else {
        await aplicarBuff(`${prefixoChave}${message.author.id}`, buffData);
        alvoUsuarios.push(message.author.id);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(aumento === 0 ? "❌ Buff removido!" : "🧬 Buff aplicado com sucesso!")
      .setColor(aumento === 0 ? 0xe74c3c : 0x2ecc71)
      .addFields(
        { name: "Tipo", value: tipo, inline: true },
        { name: "Categoria", value: categoria, inline: true },
        { name: "Aumento", value: `${aumento.toFixed(2)}x`, inline: true },
        { name: "Duração", value: duracao === 0 ? "♾️ Permanente" : `${duracao} minutos`, inline: true },
        { name: "Aplicado a", value: alvoUsuarios.length > 0 ? alvoUsuarios.map(id => `<@${id}>`).join(", ") : "Nenhum alvo específico", inline: false }
      );

    message.reply({ embeds: [embed] });
  }
};