const { QuickDB } = require("quick.db");
const db = new QuickDB();
const { EmbedBuilder } = require("discord.js");
const frutasJson = require("../frutas.json");

module.exports = {
  name: "hfruit",
  aliases: ["habilidades", "verhabilidades"],

  async execute(message) {
    return this.handle(message.author.id, msg => message.channel.send(msg));
  },

  async run(interaction) {
    return this.handle(interaction.user.id, msg => interaction.reply({ ...msg, ephemeral: true }));
  },

  async handle(userId, send) {
    const criado = await db.get(`criado_${userId}`);
    if (!criado) {
      return send({ content: "❌ Você ainda não criou seu personagem! Use `!iniciar`." });
    }

    const frutaId = await db.get(`fruta_equipada_${userId}`);
    if (!frutaId || !frutaId.id) {
      return send({ content: "🍃 Você não possui nenhuma fruta equipada no momento." });
    }

    const fruta = frutasJson.frutas.find(f => f.id === frutaId.id);
    if (!fruta) {
      return send({ content: "⚠️ Fruta equipada não encontrada no banco de dados." });
    }

    const frutaNivel = await db.get(`fruta_nivel_${userId}_${frutaId.id}`) || 1;
    const xp = await db.get(`fruta_xp_${userId}_${frutaId.id}`) || 0;
    const xpNecessario = 100 + (frutaNivel - 1) * 150;
    const progressoXP = Math.min(100, Math.floor((xp / xpNecessario) * 100));

    const habilidades = fruta.habilidades || [];
    const desbloqueadas = habilidades.filter(h => h.nivel <= frutaNivel);
    const bloqueadas = habilidades.filter(h => h.nivel > frutaNivel);

    const embed = new EmbedBuilder()
      .setTitle(`📜 Habilidades de ${fruta.nome}`)
      .setColor("#f1c40f")
      .setThumbnail(fruta.imagem || null)
      .setDescription(`**Nível atual da fruta:** ${frutaNivel}\n**XP:** ${xp}/${xpNecessario} (${progressoXP}%)`)
      .setFooter({ text: "Continue treinando para desbloquear mais habilidades!" });

    if (desbloqueadas.length) {
      embed.addFields({
        name: "**Habilidades desbloqueadas:**",
        value: desbloqueadas.map((hab, i) => `**${i + 1}. ${hab.nome}** (Nível ${hab.nivel}) – ${hab.descricao}`).join("\n")
      });
    } else {
      embed.addFields({
        name: "**Habilidades desbloqueadas:**",
        value: "Nenhuma habilidade desbloqueada ainda."
      });
    }

    // Próxima habilidade
    if (bloqueadas.length > 0) {
      const proxima = bloqueadas[0];
      const progresso = Math.min(100, Math.floor((frutaNivel / proxima.nivel) * 100));
      embed.addFields({
        name: "**Próxima habilidade a ser desbloqueada:**",
        value: `**${proxima.nome}** (Nível ${proxima.nivel})\nProgresso em nível: ${progresso}%`
      });
    } else {
      embed.addFields({
        name: "**Todas as habilidades foram desbloqueadas!**",
        value: "Você já domina todas as técnicas dessa fruta."
      });
    }

    // Transformações
    const transformacoes = fruta.transformação || [];
    if (transformacoes.length > 0) {
      const desbloqueadasTrans = transformacoes.filter(t => t.nivel <= frutaNivel);
      const bloqueadasTrans = transformacoes.filter(t => t.nivel > frutaNivel);

      if (desbloqueadasTrans.length > 0) {
        const atual = desbloqueadasTrans[desbloqueadasTrans.length - 1];
        embed.addFields({
          name: "**Transformação atual desbloqueada:**",
          value: `**${atual.nome}** (Nível ${atual.nivel})`
        });

        if (bloqueadasTrans.length > 0) {
          const prox = bloqueadasTrans[0];
          const progresso = Math.min(100, Math.floor((frutaNivel / prox.nivel) * 100));
          embed.addFields({
            name: "**Próxima transformação:**",
            value: `**${prox.nome}** (Nível ${prox.nivel})\nProgresso em nível: ${progresso}%`
          });
        } else {
          embed.addFields({
            name: "**Todas as transformações foram desbloqueadas!**",
            value: "Você atingiu o máximo de poder dessa fruta."
          });
        }
      } else {
        const primeira = transformacoes[0];
        const progresso = Math.min(100, Math.floor((frutaNivel / primeira.nivel) * 100));
        embed.addFields({
          name: "**Transformação bloqueada:**",
          value: `**${primeira.nome}** (Nível ${primeira.nivel})\nProgresso em nível: ${progresso}%`
        });
      }
    }

    return send({ embeds: [embed] });
  }
};