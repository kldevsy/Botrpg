const { QuickDB } = require("quick.db");
const db = new QuickDB();
const fs = require("fs");
const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "upfruit",
  aliases: ["upfruta", "uparfruta"],

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

    const fruta = await db.get(`fruta_equipada_${userId}`);
    if (!fruta || !fruta.id) {
      return send({ content: "🍃 Você não possui nenhuma fruta equipada no momento." });
    }

    const frutaId = fruta.id;
    const xpFruta = await db.get(`fruta_xp_${userId}_${frutaId}`) || 0;
    let nivel = await db.get(`fruta_nivel_${userId}_${frutaId}`) || 1;
    const xpNecessario = 100 + (nivel - 1) * 150;

    let frutasDB;
    try {
      const data = fs.readFileSync('./frutas.json', 'utf8');
      frutasDB = JSON.parse(data).frutas;
    } catch (err) {
      console.error("Erro ao ler frutas.json:", err);
      return send({ content: "⚠️ Erro ao carregar os dados das frutas." });
    }

    const frutaInfo = frutasDB.find(f => f.nome === fruta.nome);
    if (!frutaInfo) {
      return send({ content: "⚠️ Fruta não encontrada no banco de dados." });
    }

    if (xpFruta < xpNecessario) {
      const embed = new EmbedBuilder()
        .setTitle("📈 Treinamento de Fruta")
        .setColor("#f1c40f")
        .setDescription(`Sua fruta **${fruta.nome}** ainda não tem XP suficiente para subir de nível.`)
        .addFields(
          { name: "XP Atual", value: `${xpFruta}/${xpNecessario}`, inline: true },
          { name: "Nível Atual", value: `Lv. ${nivel}`, inline: true }
        );

      return send({ embeds: [embed] });
    }

    // Upar a fruta
    const novoXp = xpFruta - xpNecessario;
    nivel++;
    await db.set(`fruta_nivel_${userId}_${frutaId}`, nivel);
    await db.set(`fruta_xp_${userId}_${frutaId}`, novoXp);

    // Desbloqueio de habilidades
    const habilidades = frutaInfo.habilidades || [];
    let desbloqueadas = [];

    for (const hab of habilidades) {
      if (hab.nivel === nivel) {
        desbloqueadas.push(hab);
        await db.push(`fruta_habilidades_${userId}_${frutaId}`, hab);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("🍉 Fruta Evoluída!")
      .setColor("#27ae60")
      .setDescription(`Sua fruta **${fruta.nome}** subiu para o nível **${nivel}**!`)
      .addFields(
        { name: "XP Restante", value: `${novoXp}`, inline: true },
        { name: "Novo Nível", value: `Lv. ${nivel}`, inline: true }
      );

    if (desbloqueadas.length > 0) {
      embed.addFields({
        name: "✨ Habilidades Desbloqueadas",
        value: desbloqueadas.map(h => `**${h.nome}** – ${h.descricao}`).join("\n")
      });
    } else {
      embed.addFields({
        name: "Nenhuma nova habilidade",
        value: "Continue treinando para desbloquear mais!"
      });
    }

    return send({ embeds: [embed] });
  }
};