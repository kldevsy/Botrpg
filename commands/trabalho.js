const { QuickDB } = require('quick.db');
const { EmbedBuilder } = require('discord.js');
const db = new QuickDB();
const { aplicarBuffs } = require('../utils/buffUtils');

module.exports = {
  name: 'trabalho',
  description: 'Realiza um trabalho para ganhar XP e berries',
  aliases: ['work'],

  async execute(message, args) {
    const userId = message.author.id;

    const criado = await db.get(`criado_${userId}`);
    if (!criado) {
      return message.reply("❌ Você ainda não criou seu personagem! Use `!iniciar`.");
    }

    const emTrabalho = await db.get(`em_trabalho_${userId}`);
    if (emTrabalho) {
      return message.reply("⏳ Você já está realizando um trabalho! Aguarde ele ser concluído.");
    }

    const lastWorkTime = await db.get(`lastWorkTime_${userId}`);
    const now = Date.now();
    const cooldown = 2 * 60 * 1000;

    if (lastWorkTime && now - lastWorkTime < cooldown) {
      const restante = Math.ceil((cooldown - (now - lastWorkTime)) / 1000);
      return message.reply(`⏱️ Espere **${Math.ceil(restante / 60)} min** para trabalhar novamente.`);
    }

    const inteligencia = await db.get(`status_inteligencia_${userId}`) || 0;
    const reputacaoPiratas = await db.get(`reputacao_piratas_${userId}`) || 0;
    const reputacaoMarinha = await db.get(`reputacao_marinha_${userId}`) || 0;

    const opcoes = {
      pescar: { xp: 20, berries: 100, desc: "Você está pescando em alto-mar.", duracao: 60 },
      caçar: { xp: 30, berries: 150, desc: "Você está caçando na floresta.", duracao: 1800 },
      minerar: { xp: 25, berries: 120, desc: "Você está minerando em cavernas.", duracao: 3600 }
    };

    const tipo = args[0]?.toLowerCase();
    if (!tipo || !opcoes[tipo]) {
      return message.reply("❌ Escolha um trabalho: `!trabalho pescar`, `caçar` ou `minerar`.");
    }

    const trabalho = opcoes[tipo];
    let tempo = trabalho.duracao - (inteligencia * 3);
    tempo = Math.max(tempo, 30); // no mínimo 30 segundos

    await db.set(`lastWorkTime_${userId}`, now);
    await db.set(`em_trabalho_${userId}`, true);

    const eventos = [
      { nome: "Você encontrou um peixe raro!", bonus: 50 },
      { nome: "Uma tempestade atrapalhou o trabalho!", bonus: -30 },
      { nome: "Você achou um pequeno tesouro!", bonus: 100 }
    ];
    const evento = eventos[Math.floor(Math.random() * eventos.length)];

    const total = 20;
    const barra = (p) => {
      const prog = Math.floor((p / tempo) * total);
      return `\`${"🟩".repeat(prog)}${"⬜".repeat(total - prog)}\` ${Math.floor((p / tempo) * 100)}%`;
    };

    const embed = new EmbedBuilder()
      .setTitle(`💼 Trabalhando: ${tipo}`)
      .setColor(0x4b6bff)
      .setDescription(trabalho.desc)
      .addFields({ name: "Progresso", value: barra(0) })
      .setFooter({ text: "Aguarde a conclusão do trabalho..." })
      .setTimestamp();

    const msg = await message.channel.send({ embeds: [embed] });

    let progresso = 0;
    const loop = setInterval(async () => {
      progresso += 5;
      if (progresso >= tempo) return;
      embed.data.fields[0].value = barra(progresso);
      await msg.edit({ embeds: [embed] });
    }, 5000);

    setTimeout(async () => {
      clearInterval(loop);
      await db.set(`em_trabalho_${userId}`, false);

      let xp = trabalho.xp;
      let berries = trabalho.berries + evento.bonus;

      if (tipo === "pescar") {
        await db.set(`reputacao_piratas_${userId}`, reputacaoPiratas + 5);
        await db.set(`reputacao_marinha_${userId}`, reputacaoMarinha - 3);
      }

      const xpFinal = await aplicarBuffs(userId, message.guild.id, "xp", xp);
      const berriesFinal = await aplicarBuffs(userId, message.guild.id, "berries", berries);

      await db.add(`xp_${userId}`, xpFinal);
      await db.add(`berries_${userId}`, berriesFinal);

      const finalEmbed = new EmbedBuilder()
        .setTitle(`✅ Trabalho concluído: ${tipo}`)
        .setColor(0x4b6bff)
        .setDescription(`Você concluiu o trabalho de **${tipo}**!`)
        .addFields(
          { name: "XP Ganho", value: `${xpFinal}`, inline: true },
          { name: "Berries Ganhos", value: `${berriesFinal}`, inline: true },
          { name: "Evento Aleatório", value: evento.nome, inline: false }
        )
        .setFooter({ text: "Você pode trabalhar novamente em 2 minutos." })
        .setTimestamp();

      await msg.edit({ embeds: [finalEmbed] });
    }, tempo * 1000);
  }
};