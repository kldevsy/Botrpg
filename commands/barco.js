// commands/barco.js
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

module.exports = {
  name: "barco",
  description: "Mostra o status do seu navio.",
  aliases: [],

  async execute(message, args, client) {
    const userId = message.author.id;
    let barco = await db.get(`barco_${userId}`);

    if (!barco) {
      barco = {
        nome: "Pequeno Barco",
        classe: "Pequeno",
        vida: 800,
        vidaMax: 1000,
        defesa: 30,
        velocidade: 1.2,
        poderDeFogo: 80,
        upgrades: {
          casco: 1,
          vela: 1,
          canhoes: 1
        },
        xp: 0,
        nivel: 1
      };
      await db.set(`barco_${userId}`, barco);
    }

    const embed = new EmbedBuilder()
      .setTitle(`🚢 Seu Barco: ${barco.nome}`)
      .setColor("#3498db")
      .setDescription(`Classe: **${barco.classe}** | Nível: **${barco.nivel}**`)
      .addFields(
        { name: "❤️ Vida", value: `${barco.vida}/${barco.vidaMax}`, inline: true },
        { name: "🛡️ Defesa", value: `${barco.defesa}`, inline: true },
        { name: "⚡ Velocidade", value: `${barco.velocidade}x`, inline: true },
        { name: "💥 Poder de Fogo", value: `${barco.poderDeFogo}`, inline: true },
        {
          name: "🛠️ Upgrades",
          value: `Casco: ${barco.upgrades.casco} | Vela: ${barco.upgrades.vela} | Canhões: ${barco.upgrades.canhoes}`,
          inline: false
        },
        { name: "📈 XP", value: `${barco.xp} / ${barco.nivel * 100}`, inline: true }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("barco:upgrade:menu")
        .setLabel("🔧 Upgrades")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("barco:reparar")
        .setLabel("🛠️ Reparar")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("barco:navegar:menu")
        .setLabel("🧭 Navegar")
        .setStyle(ButtonStyle.Success)
    );

    message.reply({ embeds: [embed], components: [row] });
  },

  async button(interaction, { action, rest, client }) {
    const userId = interaction.user.id;
    
if (action === "reparar") {
  const barco = await db.get(`barco_${interaction.user.id}`);
  if (!barco) {
    return interaction.reply({
      content: "❌ Você ainda não possui um barco.",
      ephemeral: true
    });
  }if (typeof barco.vida !== "number") barco.vida = 0;
if (typeof barco.vidaMax !== "number") barco.vidaMax = 1000; // ou o valor padrão do seu sistema

  const dano = barco.vidaMax - barco.vida;
  if (dano <= 0) {
    return interaction.reply({
      content: "✅ Seu barco já está com a vida cheia!",
      ephemeral: true
    });
  }

  const precoPorPonto = 1;
  const materiaisNecessarios = 0;
  const custoTotal = dano * precoPorPonto;

  const berries = await db.get(`berries_${interaction.user.id}`) || 0;
  const materiais = await db.get(`materiais_${interaction.user.id}`) || 0;

  if (berries < custoTotal || materiais < materiaisNecessarios) {
    return interaction.reply({
      content: `❌ Para reparar **${dano}** de vida, você precisa:\n- 💰 **${custoTotal} berries** (você tem: ${berries})\n- 🧱 **${materiaisNecessarios} materiais** (você tem: ${materiais})`,
      ephemeral: true
    });
  }

  const novoBerries = berries - custoTotal;
const novoMateriais = materiais - materiaisNecessarios;

await db.set(`berries_${interaction.user.id}`, novoBerries);
await db.set(`materiais_${interaction.user.id}`, novoMateriais);

barco.vidaAtual = barco.vidaMax;
  barco.vida = barco.vidaMax;
await db.set(`barco_${interaction.user.id}`, barco);
  console.log(barco)
  return interaction.reply({
    content: `🛠️ Seu barco foi totalmente reparado!\n- 💰 **${custoTotal} berries** gastos\n- 🧱 **${materiaisNecessarios} materiais** usados`,
    ephemeral: true
  });
}
      

    if (action === "upgrade" && rest[0] === "menu") {
  const barco = await db.get(`barco_${userId}`);
  if (!barco) return interaction.reply({ content: "❌ Você ainda não tem um barco.", ephemeral: true });

  const { casco, vela, canhoes } = barco.upgrades;

  const embed = new EmbedBuilder()
    .setTitle("🔧 Upgrades do Navio")
    .setColor("Gold")
    .setDescription("Selecione a parte do navio que deseja melhorar:")
    .addFields(
      { name: "🛡️ Casco", value: `Nível: ${casco} | Custo: ${casco * 500} berries`, inline: true },
      { name: "🌬️ Vela", value: `Nível: ${vela} | Custo: ${vela * 500} berries`, inline: true },
      { name: "💣 Canhões", value: `Nível: ${canhoes} | Custo: ${canhoes * 500} berries`, inline: true }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("barco:upgrade:casco")
      .setLabel("🛡️ Melhorar Casco")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("barco:upgrade:vela")
      .setLabel("🌬️ Melhorar Vela")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("barco:upgrade:canhoes")
      .setLabel("💣 Melhorar Canhões")
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

  

  if (action === "upgrade") {
  const tipo = rest[0]; // <- Aqui é onde "casco", "vela" ou "canhoes" deve cair

  if (!["casco", "vela", "canhoes"].includes(tipo)) {
    return interaction.reply({ content: "❌ Tipo de upgrade inválido.", ephemeral: true });
  }

  const barco = await db.get(`barco_${userId}`);
  const berries = await db.get(`berries_${userId}`) || 0;

  if (!barco) return interaction.reply({ content: "❌ Você ainda não tem um barco.", ephemeral: true });

  const nivelAtual = barco.upgrades[tipo];
  const custo = nivelAtual * 500;

  if (berries < custo) {
    return interaction.reply({ content: `❌ Você precisa de ${custo} berries para esse upgrade!`, ephemeral: true });
  }

  let berrie = await db.get(`berries_${userId}`) || 0;
berrie -= custo;
await db.set(`berries_${userId}`, berrie);
  barco.upgrades[tipo]++;

  // Aplique os efeitos do upgrade
  if (tipo === "casco") barco.vidaMax += 100;
  if (tipo === "vela") barco.velocidade += 0.1;
  if (tipo === "canhoes") barco.poderDeFogo += 20;

  await db.set(`barco_${userId}`, barco);

  return interaction.reply({
    content: `✅ ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} melhorado para nível ${nivelAtual + 1}!`,
    ephemeral: true
  });
  }
    if (action === "navegar") {
  const barco = await db.get(`barco_${interaction.user.id}`);
  if (!barco) {
    return interaction.reply({
      content: "❌ Você ainda não tem um barco para navegar.",
      ephemeral: true,
    });
  }

  const rotas = {
    ilha_tesouro: { nome: "Ilha do Tesouro", custo: 10 },
    ilha_nevoa: { nome: "Ilha da Névoa", custo: 20 },
    ilha_guerra: { nome: "Ilha da Guerra", custo: 30 },
  };

  const embed = new EmbedBuilder()
    .setTitle("🌊 Navegação")
    .setDescription("Escolha um destino para seu barco:\nCada destino consome **vida** do barco.")
    .addFields(
      Object.entries(rotas).map(([id, info]) => ({
        name: `🧭 ${info.nome}`,
        value: `Custo: **${info.custo}** de vida`,
        inline: false
      }))
    )
    .setColor("Blue");

  const row = new ActionRowBuilder().addComponents(
    ...Object.keys(rotas).map((id) =>
      new ButtonBuilder()
        .setCustomId(`barco:viagem:${id}`)
        .setLabel(rotas[id].nome)
        .setStyle(ButtonStyle.Primary)
    )
  );

  return interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
    }
    
      
  // Atualização completa do sistema de viagem com cooldown, velocidade e eventos interativos
if (action === "viagem") {
  const rota = rest[0];
  const userId = interaction.user.id;
  const barco = await db.get(`barco_${userId}`);
  if (!barco)
    return interaction.reply({ content: "❌ Você não possui um barco.", ephemeral: true });

  const cooldownViagem = await db.get(`cooldown_viagem_${userId}`);
  const agora = Date.now();
  if (cooldownViagem && agora - cooldownViagem < 60_000) {
    const restante = Math.ceil((60_000 - (agora - cooldownViagem)) / 1000);
    return interaction.reply({
      content: `⏳ Espere **${restante}s** antes de iniciar uma nova viagem.`,
      ephemeral: true,
    });
  }

  const rotas = {
    ilha_tesouro: {
      nome: "Ilha do Tesouro",
      custo: 10,
      tempo: 10,
      eventos: ["tesouro", "materiais", "nada", "rara_tesouro", "recarregar_canhao"]
    },
    ilha_nevoa: {
      nome: "Ilha da Névoa",
      custo: 20,
      tempo: 15,
      eventos: ["nada", "tempestade", "materiais", "recarregar_canhao"]
    },
    ilha_guerra: {
      nome: "Ilha da Guerra",
      custo: 30,
      tempo: 20,
      eventos: ["piratas", "tesouro", "tempestade", "rara_espada", "recarregar_canhao"]
    },
  };

  const destino = rotas[rota];
  if (!destino)
    return interaction.reply({ content: "❌ Rota inválida.", ephemeral: true });

  if (barco.vida < destino.custo)
    return interaction.reply({
      content: `❌ Seu barco não tem vida suficiente para navegar até **${destino.nome}**.`,
    ephemeral: true
    });

  barco.vida -= destino.custo;
  await db.set(`barco_${userId}`, barco);
  await db.set(`cooldown_viagem_${userId}`, agora);

  const velocidade = barco.velocidade || 1;
  const tempoReal = Math.max(3, Math.floor(destino.tempo / velocidade));

  await interaction.update({
    content: `🌊 Navegando até **${destino.nome}**...\n⏳ Tempo estimado: **${tempoReal}s**`,
    embeds: [],
    components: [],
  });

  setTimeout(async () => {
    const todosEventos = {
      tesouro: {
        tipo: "tesouro",
        texto: "💰 Você encontrou um baú flutuante!",
        recompensa: { berries: 500 }
      },
      piratas: {
        tipo: "piratas",
        texto: "🏴‍☠️ Piratas atacaram! Seu barco sofreu danos e berries foram roubados.",
        penalidade: { vida: Math.floor(Math.random() * 10) + 10, berries: Math.floor(Math.random() * 300) + 200 }
      },
      nada: {
        tipo: "nada",
        texto: "🌤️ Viagem tranquila. Nada aconteceu."
      },
      materiais: {
        tipo: "materiais",
        texto: "🧱 Você pescou alguns materiais durante a viagem!",
        recompensa: { materiais: 5 }
      },
      tempestade: {
        tipo: "tempestade",
        texto: "🌩️ Uma tempestade atingiu o navio! Perdeu parte da vida.",
        penalidade: { vida: 15 }
      },
      rara_tesouro: {
        tipo: "rara",
        texto: "🌟 Você encontrou um baú dourado com uma **Fruta Misteriosa!**",
        recompensa: { fruta: true }
      },
      
      
    };

    const eventoTipo = destino.eventos[Math.floor(Math.random() * destino.eventos.length)];
    const evento = todosEventos[eventoTipo];

    if (evento.tipo === "recarregar") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`viagem:recarregar:${userId}`)
          .setLabel("Recarregar Canhão")
          .setStyle(ButtonStyle.Danger)
      );

      const msg = await interaction.followUp({
        content: "💣 Suas munições de canhão acabaram! Recarregue em até **3s** ou sofrerá um ataque!",
        components: [row],
        ephemeral: true
      });

      const filtro = i => i.customId === `viagem:recarregar:${userId}` && i.user.id === userId;
      const coletor = msg.createMessageComponentCollector({ filter: filtro, time: 3000, max: 1 });

      coletor.on("collect", async () => {
        await msg.edit({ content: "✅ Canhões recarregados a tempo!", components: [] });
      });

      coletor.on("end", async collected => {
        if (collected.size === 0) {
          barco.vidaAtual -= 20;
          if (barco.vidaAtual <= 0) {
            await db.delete(`barco_${userId}`);
            return interaction.followUp({
              content: "💥 Seu barco foi destruído por ataque inimigo após não conseguir recarregar!",
              ephemeral: true
            });
          } else {
            await db.set(`barco_${userId}`, barco);
            await interaction.followUp({
              content: "❌ Você falhou em recarregar. -💔 20 de vida do barco!",
              ephemeral: true
            });
          }
        }
      });

      return;
    }

    let resposta = `🧭 Você chegou com sucesso à **${destino.nome}**!\n\n`;

    if (evento.tipo === "tesouro") {
      await db.add(`berries_${userId}`, evento.recompensa.berries);
      resposta += `${evento.texto}\n+💰 ${evento.recompensa.berries} berries`;
    } else if (evento.tipo === "materiais") {
      await db.add(`materiais_${userId}`, evento.recompensa.materiais);
      resposta += `${evento.texto}\n+🧱 ${evento.recompensa.materiais} materiais`;
    } else if (evento.tipo === "piratas") {
      barco.vida -= evento.penalidade.vida;
      await db.subtract(`berries_${userId}`, evento.penalidade.berries);
      resposta += `${evento.texto}\n💔 -${evento.penalidade.vida} de vida\n💸 -${evento.penalidade.berries} berries`;
    } else if (evento.tipo === "tempestade") {
      barco.vidaAtual -= evento.penalidade.vida;
      resposta += `${evento.texto}\n💔 -${evento.penalidade.vida} de vida`;
    } else if (evento.tipo === "rara") {
      
      if (evento.recompensa.espada) {
        const espada = { nome: "Espada Antiga", dano: 4500, tipo: "épica" };
        await db.push(`espadas_inventario_${userId}`, espada);
        resposta += `${evento.texto}\n⚔️ **${espada.nome}** foi adicionada ao seu inventário!`;
      }
    } else {
      resposta += evento.texto;
    }

    if (barco.vida <= 0) {
      await db.delete(`barco_${userId}`);
      resposta += `\n\n💥 Seu barco foi completamente destruído durante a viagem!`;
    } else {
      await db.set(`barco_${userId}`, barco);
    }

    await interaction.followUp({ content: resposta, ephemeral: true });
  }, tempoReal * 1000);
}
    
    
      
        
  }
};