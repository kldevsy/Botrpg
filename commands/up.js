const { EmbedBuilder } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

const MAX_PONTOS_TOTAL = 150;

function custoPorPontoAtual(pontosAtuais) {
  return 10 + pontosAtuais * 2;
}
function barra(valor) {
  const total = 20;
  const preenchido = Math.min(valor, total);
  const vazio = total - preenchido;
  return "▰".repeat(preenchido) + "▱".repeat(vazio);
}
module.exports = {
  name: "up",
  aliases: ["upgrade"],
  description: "Upa seus status ou reseta para recuperar XP.",
  async execute(message, args) {
    const userId = message.author.id;

    const criado = await db.get(`criado_${userId}`);
    if (!criado) return message.reply("❌ Você ainda não criou seu personagem! Use `!iniciar`.");

    const nome = await db.get(`nome_${userId}`);
    const nivel = await db.get(`nivel_${userId}`) || 1;
    let xp = await db.get(`xp_${userId}`) || 0;

    let forca = await db.get(`status_forca_${userId}`) || 0;
    let defesa = await db.get(`status_defesa_${userId}`) || 0;
    let agilidade = await db.get(`status_agilidade_${userId}`) || 0;
    let inteligencia = await db.get(`status_inteligencia_${userId}`) || 0;
    let estamina = await db.get(`status_estamina_${userId}`) || 0;

    let vidamax = await db.get(`vidamax_${userId}`) || 100;
    const totalPontos = forca + defesa + agilidade + inteligencia + estamina;

    // RESET
    if (args[0] === "reset") {
      const alvo = args[1];

      if (!alvo || !["forca", "defesa", "agilidade", "inteligencia", "estamina", "all"].includes(alvo)) {
        return message.reply("❌ Uso correto: `!up reset <forca|defesa|agilidade|inteligencia|estamina|all>`");
      }

      if (alvo === "all") {
        if (totalPontos === 0) return message.reply("❌ Você não tem pontos para resetar.");

        let xpDevolvido = 0;
        for (let i = 0; i < forca; i++) xpDevolvido += custoPorPontoAtual(i);
        for (let i = 0; i < defesa; i++) xpDevolvido += custoPorPontoAtual(i);
        for (let i = 0; i < agilidade; i++) xpDevolvido += custoPorPontoAtual(i);
        for (let i = 0; i < inteligencia; i++) xpDevolvido += custoPorPontoAtual(i);
        for (let i = 0; i < estamina; i++) xpDevolvido += custoPorPontoAtual(i);
        xpDevolvido = Math.floor(xpDevolvido * 0.9);

        await db.set(`status_forca_${userId}`, 0);
        await db.set(`status_defesa_${userId}`, 0);
        await db.set(`status_agilidade_${userId}`, 0);
        await db.set(`status_inteligencia_${userId}`, 0);
        await db.set(`status_estamina_${userId}`, 0);
        await db.set(`vidamax_${userId}`, 100);
        await db.set(`xp_${userId}`, xp + xpDevolvido);

        return message.reply(`✅ Todos os status foram resetados! Você recebeu de volta **${xpDevolvido} XP** (90% do total investido).`);
      }

      let pontos = {
        forca, defesa, agilidade, inteligencia, estamina
      }[alvo];

      if (pontos === 0) return message.reply(`❌ Você não tem pontos em **${alvo}** para resetar.`);

      let xpDevolvido = 0;
      for (let i = 0; i < pontos; i++) {
        xpDevolvido += custoPorPontoAtual(i);
      }
      xpDevolvido = Math.floor(xpDevolvido * 0.9);

      await db.set(`status_${alvo}_${userId}`, 0);
      if (alvo === "defesa") {
        vidamax -= pontos * 35;
        if (vidamax < 100) vidamax = 100;
        await db.set(`vidamax_${userId}`, vidamax);
      }

      await db.set(`xp_${userId}`, xp + xpDevolvido);
      return message.reply(`✅ Status **${alvo}** resetado! Você recebeu de volta **${xpDevolvido} XP** (90% do investido).`);
    }

    // UP
    const status = args[0];
    let quantidade = parseInt(args[1]) || 1;

    if (!["forca", "defesa", "agilidade", "inteligencia", "estamina"].includes(status)) {
      const total = forca + defesa + agilidade + inteligencia + estamina;

const embed2 = new EmbedBuilder()
  .setTitle(`📊 Status de ${nome}`)
  .setColor("#00b0f4")
  .setDescription(
    `**XP disponível:** ${xp}\n` +
    `**Pontos usados:** ${total}/${MAX_PONTOS_TOTAL}\n\n` +
    `💪 Força: ${forca} ${barra(forca)}\n` +
    `🛡️ Defesa: ${defesa} ${barra(defesa)}\n` +
    `⚡ Agilidade: ${agilidade} ${barra(agilidade)}\n` +
    `🧠 Inteligência: ${inteligencia} ${barra(inteligencia)}\n` +
    `🔥 Estamina: ${estamina} ${barra(estamina)}\n` +
    `❤️ Vida Máxima: ${vidamax}`
  );
      return message.reply({ embeds:[embed2]});
      
    }
    if (quantidade <= 0) return message.reply("❌ A quantidade deve ser positiva.");
    if (totalPontos + quantidade > MAX_PONTOS_TOTAL) {
      return message.reply(`❌ Você não pode ultrapassar ${MAX_PONTOS_TOTAL} pontos somados.`);
    }

    let pontosAtuais = {
      forca, defesa, agilidade, inteligencia, estamina
    }[status];

    let custoTotal = 0;
    for (let i = 0; i < quantidade; i++) {
      custoTotal += custoPorPontoAtual(pontosAtuais + i);
    }

    if (xp < custoTotal) {
      return message.reply(`❌ Você precisa de **${custoTotal} XP**, mas só tem **${xp} XP**.`);
    }

    // Atualização de status e vida
    let novoValor = pontosAtuais + quantidade;
    await db.set(`status_${status}_${userId}`, novoValor);

    if (status === "defesa") {
      vidamax += 35 * quantidade;
      await db.set(`vidamax_${userId}`, vidamax);
    }

    await db.set(`xp_${userId}`, xp - custoTotal);

    // Embed de resposta
    const embed = new EmbedBuilder()
      .setTitle(`${nome} - Upgrade de Status`)
      .setColor("#5865F2")
      .setDescription(`Você usou **${custoTotal} XP** para aumentar **${quantidade} ponto(s)** em **${status}**.`)
      .addFields(
        { name: "Nível", value: `${nivel}`, inline: true },
        { name: "XP Restante", value: `${xp - custoTotal}`, inline: true },
        { name: "Força", value: `${status === "forca" ? novoValor : forca}`, inline: true },
        { name: "Defesa", value: `${status === "defesa" ? novoValor : defesa}`, inline: true },
        { name: "Agilidade", value: `${status === "agilidade" ? novoValor : agilidade}`, inline: true },
        { name: "Inteligência", value: `${status === "inteligencia" ? novoValor : inteligencia}`, inline: true },
        { name: "Estamina", value: `${status === "estamina" ? novoValor : estamina}`, inline: true },
        { name: "Vida Máxima", value: `${vidamax}`, inline: true },
        { name: "Pontos Totais Usados", value: `${totalPontos + quantidade}/${MAX_PONTOS_TOTAL}`, inline: true }
      )
      .setFooter({ text: "Use !up <status> <quantidade> para upar ou !up reset <status|all> para resetar." });

    return message.channel.send({ embeds: [embed] });
  }
};