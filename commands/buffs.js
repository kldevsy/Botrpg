const { EmbedBuilder } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = {
  name: "buffs",
  aliases: ["meusbuffs", "statusbuff"],
  description: "Exibe seus buffs ativos (usuário, guilda, evento e permanentes).",

  async execute(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    const tiposBuff = {
      usuario: {
        nome: "👤 Buffs do Usuário",
        prefixos: {
          "buffxp_": "🧪 XP",
          "buffxpfruta_": "🍇 XP de Fruta",
          "buffberries_": "💰 Berries"
        }
      },
      guilda: {
        nome: "🏰 Buffs da Guilda",
        prefixos: {
          "guildbuffxp_": "🧪 XP",
          "guildbuffxpfruta_": "🍇 XP de Fruta",
          "guildbuffberries_": "💰 Berries"
        }
      },
      evento: {
        nome: "🎉 Buffs de Evento",
        prefixos: {
          "eventbuffxp": "🧪 XP",
          "eventbuffxpfruta": "🍇 XP de Fruta",
          "eventbuffberries": "💰 Berries"
        }
      },
      permanente: {
        nome: "🔒 Buffs Permanentes",
        prefixos: {
          "permabuffxp_": "🧪 XP",
          "permabuffxpfruta_": "🍇 XP de Fruta",
          "permabuffberries_": "💰 Berries"
        }
      }
    };

    async function gerarListaBuffs() {
      const listaFinal = [];

      for (const tipo in tiposBuff) {
        const data = tiposBuff[tipo];
        const buffsAtivos = [];

        for (const prefixo in data.prefixos) {
          const nome = data.prefixos[prefixo];
          let buff;

          if (tipo === "evento") {
            buff = await db.get(prefixo);
          } else if (tipo === "guilda") {
            buff = await db.get(`${prefixo}${guildId}`);
          } else {
            buff = await db.get(`${prefixo}${userId}`);
          }

          if (buff) {
            if (buff.expira && Date.now() > buff.expira) {
              // Buff expirado, remover
              const chave = tipo === "evento" ? prefixo : `${prefixo}${tipo === "guilda" ? guildId : userId}`;
              await db.delete(chave);
              continue;
            }

            let linha = `**${nome}**\n🔺 Aumento: \`${buff.aumento || 1.0}x\``;

            if (buff.expira) {
              const restante = buff.expira - Date.now();
              const m = Math.floor(restante / 60000);
              const s = Math.floor((restante % 60000) / 1000);
              linha += `\n⏱️ Tempo restante: \`${m}m ${s}s\``;
            }

            buffsAtivos.push(linha);
          }
        }

        if (buffsAtivos.length > 0) {
          listaFinal.push(`__**${data.nome}**__\n${buffsAtivos.join("\n")}`);
        }
      }

      return listaFinal;
    }

    const embed = new EmbedBuilder()
      .setTitle("🧬 Buffs Ativos")
      .setColor("#3498db")
      .setDescription("Carregando...");

    const msg = await message.reply({ embeds: [embed] });

    let ciclos = 0;
    const intervalo = setInterval(async () => {
      const lista = await gerarListaBuffs();
      embed.setDescription(lista.length > 0 ? lista.join("\n\n") : "❌ Nenhum buff ativo.");
      await msg.edit({ embeds: [embed] });

      ciclos++;
      if (ciclos >= 12) clearInterval(intervalo); // 12 ciclos = 60s
    }, 5000);
  }
};