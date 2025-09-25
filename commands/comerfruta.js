const { QuickDB } = require("quick.db");
const db = new QuickDB();
const { EmbedBuilder } = require("discord.js");
const frutasDB = require("../frutas.json").frutas;

module.exports = {
  name: "comerfruta",
  aliases: ["eatfruit"],

  async execute(message, args) {
    const frutaNome = args.join(" ");
    if (!frutaNome) {
      return message.reply("❓ Digite o nome da fruta que deseja comer. Ex: `!comerfruta Gomu Gomu no Mi`");
    }
    // No comando de texto, o segundo parâmetro fica null, o terceiro é o nome.
    await this.run(message, null, frutaNome);
  },

  async button(interaction) {
    const [, acao, frutaId] = interaction.customId.split(":");

    if (acao === "comer") {
      await this.run(interaction, frutaId); // frutaId enviado pelo botão
    } else {
      await interaction.reply({ content: "❌ Ação inválida para este botão.", ephemeral: true });
    }
  },

  async run(contexto, frutaId, frutaNome = null) {
    const userId = contexto.user?.id || contexto.author?.id;
    if (!userId) return;

    // Se foi fornecido um ID, procuramos o nome da fruta no inventário do usuário
    if (frutaId && !frutaNome) {
      const inventario = await db.get(`frutas_inventario_${userId}`) || [];
      const fruta = inventario.find(f => f.id === frutaId);
      if (!fruta) {
        return responder(contexto, "❌ Essa fruta não está mais no seu inventário.", true);
      }
      frutaNome = fruta.nome;
    }

    await processarComerFruta(contexto, frutaNome, true);
  },
};

async function processarComerFruta(context, frutaNome, viaBotao = false) {
  const user = context.user || context.author;
  const userId = user.id;

  const criado = await db.get(`criado_${userId}`);
  if (!criado) {
    return responder(context, "❌ Você ainda não criou seu personagem! Use `!iniciar`.", viaBotao);
  }

  const frutaEquipada = await db.get(`fruta_equipada_${userId}`);
  if (frutaEquipada) {
    return responder(
      context,
      `⚠️ Você já comeu a fruta **${frutaEquipada.nome}**! Para comer outra, se livre da atual.`,
      viaBotao
    );
  }

  const inventario = await db.get(`frutas_inventario_${userId}`) || [];
  const frutaEscolhida = inventario.find(f => f.nome.toLowerCase() === frutaNome.toLowerCase());
  if (!frutaEscolhida) {
    return responder(context, "❌ Você não possui essa fruta no inventário.", viaBotao);
  }

  const frutaId = frutaEscolhida.id;
  let nivelFruta = await db.get(`fruta_nivel_${userId}_${frutaId}`) || 1;
  const nivelMax = 10;
  if (nivelFruta < nivelMax) nivelFruta++;

  // Remover a fruta do inventário
  const novaLista = [...inventario];
  const index = novaLista.findIndex(f => f.id === frutaId);
  if (index !== -1) novaLista.splice(index, 1);

  await db.set(`frutas_inventario_${userId}`, novaLista);
  await db.set(`fruta_equipada_${userId}`, frutaEscolhida);
  await db.set(`fruta_nivel_${userId}_${frutaId}`, nivelFruta);

  const embed = new EmbedBuilder()
    .setTitle("🍽 Fruta Comida com Sucesso!")
    .setDescription(`${user.username} comeu a **${frutaEscolhida.nome}**!`)
    .addFields(
      { name: "Raridade", value: frutaEscolhida.raridade, inline: true },
      { name: "Nível Atual", value: `Lv. ${nivelFruta}`, inline: true }
    )
    .setColor("#2ecc71");

  return responder(context, { embeds: [embed] }, viaBotao);
}

function responder(context, resposta, viaBotao = false) {
  const payload = typeof resposta === "string" ? { content: resposta } : resposta;
  payload.ephemeral = true;

  if (viaBotao) {
    if (context.deferred || context.replied) {
      return context.followUp(payload).catch(() => {});
    } else {
      return context.reply(payload).catch(() => {});
    }
  }

  return context.channel.send(typeof resposta === "string" ? resposta : resposta);
}