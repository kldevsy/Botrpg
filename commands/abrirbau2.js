const { EmbedBuilder } = require("discord.js");
const { QuickDB } = require("quick.db");
const fs = require("fs");

const db = new QuickDB();
const cooldown = new Set();

module.exports = {
  name: "abrirbau2",
  aliases: [],
  async execute(message, args) {
    const userId = message.author.id;
    if (cooldown.has(userId)) {
      return message.channel.send({ content: "⏳ | Espere um momento antes de abrir outro baú!" });
    }

    cooldown.add(userId);
    setTimeout(() => cooldown.delete(userId), 5000);

    const tipoBau = args[0];
    if (!tipoBau)
      return message.channel.send({ content: "❌ | Informe o tipo do baú. Ex: `!abrirbau bau_lendario`" });

    const bausData = JSON.parse(fs.readFileSync("./baus.json", "utf8"));
    const frutasData = JSON.parse(fs.readFileSync("./frutas.json", "utf8"));
    const espadasData = JSON.parse(fs.readFileSync("./espadas.json", "utf8"));
    const equipamentosData = JSON.parse(fs.readFileSync("./equipamentos.json", "utf8"));

    const bau = bausData.baus[tipoBau];
    if (!bau) return message.channel.send({ content: "❌ | Baú não encontrado." });

    const chaves = {
      bau_comum: "comum_",
      bau_raro: "raro_",
      bau_epico: "epico_",
    };

    const chave = chaves[tipoBau];
    if (!chave) return message.channel.send({ content: "❌ | Tipo de baú inválido." });

    const qtd = (await db.get(`${chave}${userId}`)) || 0;
    if (qtd <= 0) return message.channel.send({ content: `❌ | Você não possui nenhum ${tipoBau.replace("bau_", "baú ")}.` });

    await db.sub(`${chave}${userId}`, 1);

    // Multiplicador
    let multiplicador = bau.multiplicador || 1;
    let mults = await db.get(`multiplicadores_${userId}`) || [];

    if (mults.length > 0 && bau.ticketsMultiplicador?.valores) {
      const embedMult = new EmbedBuilder()
        .setTitle("Multiplicadores disponíveis")
        .setDescription(`Você tem: \`${mults.join("%, ")}%\`\nDigite o valor em % para usar (ex: \`100\`) ou \`pular\`.`)
        .setColor("#FFD700");

      await message.channel.send({ embeds: [embedMult] });

      const res = await message.channel.awaitMessages({
        filter: m => m.author.id === userId,
        max: 1,
        time: 30000
      });

      const escolha = res.first()?.content?.toLowerCase() || "pular";
      const numMult = parseInt(escolha);
      if (escolha !== "pular" && !isNaN(numMult) && mults.includes(numMult)) {
        multiplicador += numMult / 100;
        mults = mults.filter(m => m !== numMult);
        await db.set(`multiplicadores_${userId}`, mults);
        await message.channel.send({ content: `✅ | Multiplicador de \`${numMult}%\` aplicado! Total: \`${multiplicador.toFixed(2)}x\`` });
      }
    }

    // Crítico
    let vezes = 1;
    if (bau.critico && Math.random() < bau.critico.chance) {
      vezes = Math.floor(Math.random() * (bau.critico.bonusMax - bau.critico.bonusMin + 1)) + bau.critico.bonusMin;
      await message.channel.send({ content: `💥 | **Crítico!** Você receberá \`${vezes}\` recompensas!` });
    }

    const rand = arr => arr[Math.floor(Math.random() * arr.length)];

    let recompensas = {
      berries: 0,
      xp: 0,
      xpfruit: 0,
      materiais: 0,
      frutas: [],
      espadas: [],
      equipamentos: []
    };

    for (let i = 0; i < vezes; i++) {
      const q = bau.quantidade;
      if (q) {
        recompensas.berries += Math.floor((Math.random() * (q.berries[1] - q.berries[0] + 1) + q.berries[0]) * multiplicador);
        recompensas.xp += Math.floor((Math.random() * (q.xp[1] - q.xp[0] + 1) + q.xp[0]) * multiplicador);
        recompensas.xpfruit += Math.floor((Math.random() * (q.xpfruit[1] - q.xpfruit[0] + 1) + q.xpfruit[0]) * multiplicador);
        recompensas.materiais += Math.floor((Math.random() * (q.materiais[1] - q.materiais[0] + 1) + q.materiais[0]) * multiplicador);
      }

      if (bau.garantido) {
        if (bau.garantido.frutas) recompensas.frutas.push(...bau.garantido.frutas);
        if (bau.garantido.espadas) recompensas.espadas.push(...bau.garantido.espadas);
        if (bau.garantido.equipamentos) recompensas.equipamentos.push(...bau.garantido.equipamentos);
      }

      if (bau.aleatorio) {
        if (bau.aleatorio.frutas) recompensas.frutas.push(rand(bau.aleatorio.frutas));
        if (bau.aleatorio.espadas) recompensas.espadas.push(rand(bau.aleatorio.espadas));
        if (bau.aleatorio.equipamentos) recompensas.equipamentos.push(rand(bau.aleatorio.equipamentos));
      }
    }

    const frutasInventario = await db.get(`frutas_inventario_${userId}`) || [];
    const slotsFruta = await db.get(`slots_fruta_${userId}`) || 3;
    const espadasAtuais = await db.get(`espadas_${userId}`) || [];
    let equipsAtuais = await db.get(`equipamentos_${userId}`) || [];

    const frutasObtidas = [];
    const novasEspadas = [];
    const novosEquips = [];

    for (const frutaId of recompensas.frutas) {
      if (Math.random() < 0.15 && frutasInventario.length < slotsFruta) {
        const fruta = frutasData.frutas.find(f => f.id === frutaId);
        if (fruta) frutasObtidas.push(fruta);
      }
    }

    for (const espadaId of recompensas.espadas) {
      if (Math.random() < 0.1 && !espadasAtuais.includes(espadaId)) {
        novasEspadas.push(espadaId);
      } else {
        recompensas.berries += 1000;
      }
    }

    for (const equipId of recompensas.equipamentos) {
      if (Math.random() < 0.1 && !equipsAtuais.includes(equipId)) {
        novosEquips.push(equipId);
      } else {
        recompensas.berries += 800;
      }
    }

    // Ticket multiplicador
    let valorMultiplicador = "nenhum";
    if (bau.ticketsMultiplicador && Math.random() < bau.ticketsMultiplicador.chance) {
      const valores = bau.ticketsMultiplicador.valores;
      valorMultiplicador = rand(valores);
      let tickets = await db.get(`multiplicadores_${userId}`) || [];
      tickets.push(valorMultiplicador);
      await db.set(`multiplicadores_${userId}`, tickets);
    }

    // Aplicar recompensas
    await db.add(`berries_${userId}`, recompensas.berries);
    await db.add(`xp_${userId}`, recompensas.xp);
    await db.add(`xpfruit_${userId}`, recompensas.xpfruit);
    await db.add(`materiais_${userId}`, recompensas.materiais);
    frutasInventario.push(...frutasObtidas);
    await db.set(`frutas_inventario_${userId}`, frutasInventario);
    await db.set(`espadas_${userId}`, espadasAtuais.concat(novasEspadas));
    //await db.set(`equipamentos_${userId}`, equipsAtuais.concat(novosEquips));

    const embedMsg = await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("Abrindo Baú...")
          .setDescription("🎁 Carregando recompensas, aguarde...")
          .setColor("#FFD700")
      ]
    });

    const linhas = [
      `**Multiplicador:** \`${multiplicador.toFixed(2)}x\``,
      `Berries: ${recompensas.berries}`,
      `XP: ${recompensas.xp}`,
      `XP Fruta: ${recompensas.xpfruit}`,
      `Materiais: ${recompensas.materiais}`,
      `Multiplicador ganho: ${valorMultiplicador}`,
      `Frutas: ${frutasObtidas.length ? frutasObtidas.map(f => f.nome).join(", ") : "Nenhuma"}`,
      `Espadas: ${novasEspadas.length ? novasEspadas.map(id => espadasData.espadas.find(e => e.id === id)?.nome || "Desconhecida").join(", ") : "Nenhuma"}`,
      `Equipamentos: ${novosEquips.length ? novosEquips.map(id => equipamentosData.equipamentos.find(e => e.id === id)?.nome || "Desconhecido").join(", ") : "Nenhum"}`
    ];

    let i = 0;
    const atualizar = async () => {
      if (i >= linhas.length) return;
      await embedMsg.edit({
        embeds: [
          new EmbedBuilder()
            .setTitle("Recompensas do Baú")
            .setDescription(linhas.slice(0, i + 1).join("\n"))
            .setColor("#00FF99")
        ]
      });
      i++;
      setTimeout(atualizar, 1000);
    };

    atualizar();
  }
};