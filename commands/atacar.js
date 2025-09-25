const { QuickDB } = require("quick.db");
const { EmbedBuilder } = require("discord.js");
const bossesData = require("../bosses.json");
const frutas = require("../frutas.json");
const espadas = require("../espadas.json");
const hb = require("../Habilidades.json");

const db = new QuickDB();
const bosses = bossesData.bosses;

function gerarBarraDeVida(vidaAtual, vidaMaxima, blocos = 10) {
  const porcentagem = Math.max(0, Math.min(vidaAtual / vidaMaxima, 1));
  const blocosCheios = Math.round(porcentagem * blocos);
  const blocosVazios = blocos - blocosCheios;
  const barra = "🟩".repeat(blocosCheios) + "🟥".repeat(blocosVazios);
  return `${barra} ${Math.floor(porcentagem * 100)}%`;
}

function calcularDanoBase(habilidade, forca, danoEquipamento, upgradeEspada, danohaki) {
  const danoBruto = habilidade.dano || 5;
  return Math.floor(danoBruto * 0.75 + forca);
}

module.exports = {
  name: "atacar",
  description: "Inicia o combate contra o boss ativo",
  aliases: [],
  async execute(message, args) {
    const userId = message.author.id;
    const serverId = message.guild.id;

    const bossData = await db.get(`boss_ativo_${serverId}`);
    if (!bossData) {
      return message.channel.send("Nenhum Boss está ativo neste momento neste servidor.");
    }

    const tempoRestante = bossData.timestamp + 3600000 - Date.now();
    if (tempoRestante <= 0) {
      await db.delete(`boss_ativo_${serverId}`);
      return message.channel.send("O tempo para derrotar o Boss acabou!");
    }

    const boss = bosses.find((b) => b.id === bossData.id);
    if (!boss) return message.channel.send("Erro ao carregar o Boss.");

    const haki = await db.get(`haki_${userId}`) || [];

    let indexNpc = 0;
    let vidaJogador = await db.get(`vida_${userId}`) || 100;
    let staminaJogador = 100;
    const cooldowns = {};
    let npcStun = 0;
    let v = 5;
    let buff = 0;
    let fcc = 0;
    let nomeform = `base`;
    let dur = 0;
    let text = `nenhum`;

    if (!(await db.has(`stamina_${userId}`))) await db.set(`stamina_${userId}`, 100);
    let stamina = await db.get(`stamina_${userId}`);
    const stunBoss = await db.get(`stun_boss_${serverId}`) || 0;

    async function iniciarCombate() {
      const bossvida = await db.get(`boss_ativo_${serverId}.vida`);

      const frutaId = await db.get(`fruta_equipada_${userId}`);
      let fruta = null;

      if (frutaId) {
        fruta = frutas.frutas.find((f) => f.id === frutaId.id);
      }

      const frutaNivel = await db.get(`fruta_nivel_${userId}_${frutaId?.id}`) || 1;
      const carga = await db.get(`gorocarga_${userId}_${frutaId?.id}`) || 1.5;

      function calcularMillionVoltVari(nivel) {
        const dadosPorNivel = [
          { nivel: 1.5, dano: 1000, stamina: 6 },
          {
            nivel: 10,
            dano: 4000,
            stamina: 10,
            efeito: { tipo: "shock", chance: 0.3, turnos: 1 },
          },
          {
            nivel: 20,
            dano: 9000,
            stamina: 12,
            efeito: { tipo: "shock", chance: 1.0, turnos: 1 },
          },
          {
            nivel: 30,
            dano: 12000,
            stamina: 15,
            efeito: { tipo: "shock", area: true, chance: 0.4, turnos: 1 },
          },
          { nivel: 50, dano: 15000, stamina: 18, ignoraDefesa: true },
          {
            nivel: 60,
            dano: 18000,
            stamina: 20,
            efeito: { tipo: "shock", area: true, chance: 0.5, turnos: 1 },
          },
          {
            nivel: 100,
            dano: 22000,
            stamina: 25,
            efeito: { tipo: "shock", chance: 1.0, turnos: 2 },
          },
          {
            nivel: 200,
            dano: 25000,
            stamina: 40,
            efeito: { tipo: "shock", chance: 1.0, turnos: 2 },
            queimaStamina: true,
          },
        ];

        return dadosPorNivel.find((x) => x.nivel === nivel) || dadosPorNivel[0];
      }

      const habilidadesFruta =
  fruta?.habilidades?.filter((h) => h.nivel <= frutaNivel) || [];

const form =
  fruta?.transformação && Array.isArray(fruta.transformação)
    ? fruta.transformação.filter((h) => h.nivel <= frutaNivel)
    : [];

const espadaId = await db.get(`espada_${userId}`);
const espada = espadas.espadas.find((e) => e.id === espadaId);
const habilidadesEspada = espada?.habilidades || [];

const hakiID = `haki`;
const hk = hb.habilidades.find((f) => f.id === hakiID);
const forca = await db.get(`forca_${userId}`) || 10;

const hkab = hk?.hab?.filter((h) => h.nivel <= 1) || [];
turnoJogador();
async function turnoJogador() {
  let jogadorParalisado = false;
  let efeitosAtivos = await db.get(`efeitos_${userId}_${serverId}`) || [];

  efeitosAtivos = efeitosAtivos
    .map((efeito) => {
      if (efeito.tipo === "shock" && efeito.turnosRestantes > 0) {
        if (Math.random() < efeito.chanceFalha) {
          jogadorParalisado = true;
          console.log("Você foi paralisado pelo choque e perdeu o turno!");
        }
        efeito.turnosRestantes--;
      }
      return efeito;
    })
    .filter((e) => e.turnosRestantes > 0);

  await db.set(`efeitos_${userId}_${serverId}`, efeitosAtivos);

  if (jogadorParalisado) {
    await message.channel.send("🌀 Você está atordoado e perdeu o turno!");
    return turnoNpc();
  }

  const habilidades = [
    ...habilidadesEspada,
    ...habilidadesFruta,
    ...form,
    ...hkab,
  ];

  if (habilidades.length === 0) {
    return message.channel.send("Você não tem habilidades para usar.");
  }

  const habilidadesDisponiveis = habilidades.filter((h, i) => {
    const id = `${h.nome}_${i}`;
    const emCooldown = cooldowns[id] && cooldowns[id] > 0;
    return !emCooldown && h.custoStamina <= stamina;
  });

  const vidaAtual = bossData.vida;
  const vidaMaxima = boss.vida;

  const habilidadesTexto = habilidadesDisponiveis
    .map(
      (h, i) =>
        `\`${i + 1}\` - **${h.nome}**: ${h.descricao} (Stamina: ${h.custoStamina}, CD: ${h.cooldown})`
    )
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`${boss.nome} [HP: ${vidaAtual}/${vidaMaxima}]`)
    .setColor("Blue")
    .setDescription(
      `Escolha sua habilidade digitando o número correspondente:\n\n${habilidadesTexto}\n\n**Stamina:** ${stamina}/100`
    );

  await message.channel.send({ embeds: [embed] });

  const filtro = (m) => m.author.id === userId;
  const coletor = message.channel.createMessageCollector({
    filter: filtro,
    max: 1,
    time: 30000,
  });

  coletor.on("collect", async (msg) => {
    if (msg.content.toLowerCase() === "cancelar") {
      await db.delete(`quest_${userId}`);
      return message.channel.send("❌ Você cancelou a missão.");
    }

    const index = parseInt(msg.content) - 1;
const habilidade = habilidadesDisponiveis[index];

if (!habilidade) {
  await message.channel.send("Número inválido.");
  return turnoJogador();
}

staminaJogador -= habilidade.custoStamina;

const cooldownId = `${habilidade.nome}_${habilidades.indexOf(habilidade)}`;
cooldowns[cooldownId] = habilidade.cooldown;

if (habilidade.dano === 0) {
  if (habilidade.defesa > 0) {
    await db.set(`defesa_temporaria_${userId}`, habilidade.defesa);
  }
  if (habilidade.stun) {
    npcStun = habilidade.stun;
  }

  if (habilidade.nome === "gear second") {
    const base = forca;
    const porcentagem = habilidade.buff; // 30%
    fcc = Math.ceil(base + base * (porcentagem / 100));
    buff = fcc;
    nomeform = habilidade.nome;
    console.log(habilidade.nome);
    v = 5;
  }

  let health = 0;
  if (habilidade.cura > 0) {
    const base = vidaJogador;
    const porcentagem = habilidade.cura;

    health = Math.ceil(base + base * (porcentagem / 100));
    vidaJogador = Math.min(vidaJogador + health, 150);
  }

  const embed2 = new EmbedBuilder()
    .setTitle(`✨ ${habilidade.nome}`)
    .setColor("Blue")
    .setDescription(
      `Você usou **${habilidade.nome}**!\n\n${habilidade.descricao}`
    );

  if (habilidade.imagem) {
    embed2.setImage(habilidade.imagem);
  }

  await message.channel.send({ embeds: [embed2] });

} else {
  // Habilidade de ataque
  let fc2 = forca;

  if (habilidade.nome === "haki") dur = 10;

  if (dur > 0 && habilidade.tipo === "espada") {
    const base = forca;
    const porcentagem = habilidade.dano;
    fc2 = Math.ceil(base + base * (porcentagem / 100));
  }

  if (dur > 0) dur--;

  let danoFinal = 0;

  if (boss.anti === "logia") {
    if (habilidade.tipo === "espada" && dur <= 0) {
      danoFinal = 0;
      await message.reply("NPC com logia ativa.");
    } else {
      danoFinal = calcularDanoBase(habilidade, forca + fc2);
    }
  } else {
    danoFinal = calcularDanoBase(habilidade, forca + fc2);
  }

  let nm = `💚 sua vida`;

  if (v > 0) {
    nm = `💚 sua vida(${nomeform})`;
    v--;
    if (habilidade.tipo !== "espada") {
      danoFinal += buff;
    }
  } else {
    buff = 0;
  }

  console.log("danofinal", danoFinal);

  if (boss.defesa) {
    danoFinal = Math.max(0, danoFinal - boss.defesa);
  }

  // Aplicar efeito de fogo
  if (habilidade.burn) {
    if (!boss.efeitosAtivos) boss.efeitosAtivos = [];

    boss.efeitosAtivos.push({
      tipo: "burn",
      dano: habilidade.burn.danoPorTurno,
      turnosRestantes: habilidade.burn.turnos,
      origem: userId,
    });
  }

  // Aplicar efeito de choque
  if (
    habilidade.efeitoEspecial &&
    habilidade.efeitoEspecial.tipo === "shock"
  ) {
    if (!boss.efeitosAtivos) boss.efeitosAtivos = [];

    boss.efeitosAtivos.push({
      tipo: "shock",
      chanceFalha:
        habilidade.efeitoEspecial.chanceFalharProximoTurno || 0.3,
      turnosRestantes: habilidade.efeitoEspecial.turnos || 1,
    });
  }

  let name = habilidade.nome;

if (habilidade.nome === "Million Volt Vari") {
  const detalhes = calcularMillionVoltVari(carga);

  if (staminaJogador < detalhes.stamina) {
    console.log("Stamina insuficiente para usar essa variação!");
    // Pode usar ataque básico ou outro fallback aqui
  } else {
    name = `${carga} ${habilidade.nome}`;
    staminaJogador -= detalhes.stamina;
    danoFinal = danoFinal + detalhes.dano;
    // Aplicar dano ao jogador normalmente
  }
} else {
  name = habilidade.nome;
}
  const bossvida3 = await db.get(`boss_ativo_${serverId}.vida`);

await db.set(`boss_ativo_${serverId}.vida`, bossvida3 - danoFinal);
 

if (habilidade.stun) {
  npcStun = habilidade.stun;
  console.log(habilidade.stun);
}

await message.channel.send({
  embeds: [
    new EmbedBuilder()
      .setTitle(`💥 ${name}`)
      .setColor("#2ecc71")
      .setDescription(
        `Você causou **${danoFinal}** de dano\nMovimento: **${habilidade.descricao}**!`
      )
      .addFields(
        { name: "❤️ Vida do NPC", value: gerarBarraDeVida(bossvida, boss.vida), inline: true },
        { name: `${nm}`, value: gerarBarraDeVida(vidaJogador, 150), inline: true },
        { name: "⚡ Stamina", value: `${staminaJogador}/100`, inline: true }
      ),
  ],
});

const bossvida2 = await db.get(`boss_ativo_${serverId}.vida`);
console.log(bossvida2)
if (bossvida2 <= 0) {
  await db.delete(`boss_ativo_${serverId}`);

  const jogadores = (await db.all())
    .filter(i => i.id.startsWith(`boss_dano_${serverId}_`))
    .map(i => ({
      userId: i.id.replace(`boss_dano_${serverId}_`, ""),
      dano: i.value,
    }));

  const qualificados = jogadores.filter(j => j.dano >= 15000);
  const top = jogadores.sort((a, b) => b.dano - a.dano)[0];

  await message.channel.send(`**${boss.nome} foi derrotado!**`);

  for (const jogador of qualificados) {
    const recompensaBase = boss.recompensa || {
      berries: 10000,
      xp: 2000,
      xpfruit: 1000,
    };

    const multi = jogador.userId === top.userId ? 1.5 : 1;

    const berries = Math.floor(recompensaBase.berries * multi);
    const xp = Math.floor(recompensaBase.xp * multi);
    const xpfruit = Math.floor(recompensaBase.xpfruit * multi);

    await db.add(`berries_${jogador.userId}`, berries);
    await db.add(`xp_${jogador.userId}`, xp);
    await db.add(`fruta_xp_${userId}_${frutaId.id}`, xpfruit);

    const drops = boss.drops;
    const recompensas = [];

    const chanceItem = (chance) => Math.random() < chance;

    // Equipamentos (30%)
    if (drops.equipamentos.length && chanceItem(0.3)) {
      const equipamento = drops.equipamentos[Math.floor(Math.random() * drops.equipamentos.length)];
      const equipamentos = await db.get(`equipamentos_${jogador.userId}`) || [];
      if (!equipamentos.includes(equipamento)) {
        equipamentos.push(equipamento);
        await db.set(`equipamentos_${jogador.userId}`, equipamentos);
        recompensas.push(`Equipamento: ${equipamento}`);
      }
    }

    // Espadas (25%)
    if (drops.espadas.length && chanceItem(0.25)) {
      const espada = drops.espadas[Math.floor(Math.random() * drops.espadas.length)];
      const espadas = await db.get(`espadas_${jogador.userId}`) || [];
      if (!espadas.includes(espada)) {
        espadas.push(espada);
        await db.set(`espadas_${jogador.userId}`, espadas);
        recompensas.push(`Espada: ${espada}`);
      }
    }

    // Frutas (20%)
    if (drops.frutas.length && chanceItem(0.2)) {
      const frutaIdDrop = drops.frutas[Math.floor(Math.random() * drops.frutas.length)];
      const fruta = frutas.frutas.find(f => f.nome === frutaIdDrop);
      if (fruta) {
        const frutasUser = await db.get(`frutas_inventario_${jogador.userId}`) || [];
        const jaTem = frutasUser.find(f => f.nome === fruta.nome);
        const slots = await db.get(`slots_fruta_${jogador.userId}`) || 30;

        if (!jaTem && frutasUser.length < slots) {
          await db.set(`frutas_inventario_${jogador.userId}`, [...frutasUser, fruta]);
          recompensas.push(`Fruta: ${fruta.nome}`);
        }
      }
    }

    // Baús (1 garantido)
    if (drops.baus.length) {
      const bau = drops.baus[Math.floor(Math.random() * drops.baus.length)];
      if (bau.includes("comum")) await db.add(`comum_${jogador.userId}`, 1);
      else if (bau.includes("raro")) await db.add(`raro_${jogador.userId}`, 1);
      else if (bau.includes("epico")) await db.add(`epico_${jogador.userId}`, 1);
      else if (bau.includes("lendario")) await db.add(`lendario_${jogador.userId}`, 1);

      recompensas.push(`Baú: ${bau}`);
    }

    const user = await client.users.fetch(jogador.userId);

    if (recompensas.length) {
      await user.send(`Você recebeu os seguintes itens:\n${recompensas.join("\n")}`);
    } else {
      await user.send(`Você derrotou o boss, mas não recebeu itens especiais desta vez.`);
    }

    await user.send(
      `Recompensas por derrotar o boss:\n+${berries} berries\n+${xp} XP\n+${xpfruit} XP de fruta`
    );
  }

  return;
}

await turnoNpc();
}
  });
coletor.on("end", (c) => {
  if (c.size === 0)
    message.channel.send("⏰ Tempo esgotado. O combate foi cancelado.");
});

async function turnoNpc() {
  if (npcStun > 0) {
    npcStun--;
    await message.channel.send("🌀 O inimigo está atordoado e perdeu o turno!");
    return turnoJogador();
  }

  if (boss.efeitosAtivos) {
    for (const efeito of boss.efeitosAtivos) {
      if (efeito.tipo === "burn" && efeito.turnosRestantes > 0) {
        boss.vida -= efeito.dano;
        const full = frutaNivel * efeito.dano;
        await db.subtract(`boss_ativo_${serverId}.vida`, full);

        efeito.turnosRestantes--;

        console.log(`O boss sofreu ${efeito.dano} de queimadura!`);
      }
    }

    boss.efeitosAtivos = boss.efeitosAtivos.filter((e) => e.turnosRestantes > 0);
  }

  let impedirAtaque = false;

  if (Array.isArray(boss.efeitosAtivos) && boss.efeitosAtivos.length) {
    for (const efeito of boss.efeitosAtivos) {
      if (efeito.tipo === "shock" && efeito.turnosRestantes > 0) {
        if (Math.random() < efeito.chanceFalha) {
          impedirAtaque = true;
          console.log("O boss ficou paralisado pelo choque e perdeu a vez!");
        }
        efeito.turnosRestantes--;
      }
    }

    boss.efeitosAtivos = boss.efeitosAtivos.filter((e) => e.turnosRestantes > 0);
  }

  if (impedirAtaque) {
    await message.channel.send("🌀 O inimigo está atordoado e perdeu o turno!");
    return turnoJogador();
  }

  // Verifica e ativa forma alternativa se existir e boss ainda não trocou e vida zerada
  if (boss.formaAlternativa && !boss.formaAtivada && bossvida <= 0) {
    boss.formaAtivada = true;

    boss.habilidades = boss.formaAlternativa.habilidades;
    boss.vida = boss.formaAlternativa.vidaExtra;
    boss.nome = boss.formaAlternativa.nome || boss.nome;
    boss.descricao = boss.formaAlternativa.descricao || boss.descricao;

    boss.cooldowns = {};
    boss.staminaAtual = 100;

    // Opcional: mensagem avisando a transformação
    await message.channel.send(`💥 **${boss.nome} entrou em sua forma alternativa!**`);
  }

  if (!boss.cooldowns) boss.cooldowns = {};
  if (boss.staminaAtual === undefined) boss.staminaAtual = 100;

  const habilidadesDisponiveis = boss.habilidades.filter((hab) => {
    const emCooldown = boss.cooldowns[hab.nome] > 0;
    const temStamina = boss.staminaAtual >= hab.custoStamina;
    return !emCooldown && temStamina;
  });

  let habilidade;

  if (habilidadesDisponiveis.length > 0) {
    habilidade =
      habilidadesDisponiveis[
        Math.floor(Math.random() * habilidadesDisponiveis.length)
      ];

    boss.staminaAtual -= habilidade.custoStamina;

    boss.cooldowns[habilidade.nome] = habilidade.cooldown;
  } else {
    habilidade = {
      nome: "Ataque Selvagem",
      descricao: "Um ataque comum e desesperado.",
      dano: 3000,
      stun: false,
      custoStamina: 0,
      cooldown: 0,
    };
  }

// Reduz cooldowns no fim do turno
for (const nome in boss.cooldowns) {
  if (boss.cooldowns[nome] > 0) boss.cooldowns[nome]--;
}

// Efeito de shock
if (habilidade.efeitoEspecial && habilidade.efeitoEspecial.tipo === "shock") {
  const efeitosJogador = (await db.get(`efeitos_${userId}_${serverId}`)) || [];

  efeitosJogador.push({
    tipo: "shock",
    chanceFalha: habilidade.efeitoEspecial.chanceFalharProximoTurno || 0.3,
    turnosRestantes: habilidade.efeitoEspecial.turnos || 1,
  });

  await db.set(`efeitos_${userId}_${serverId}`, efeitosJogador);
}

// Reduz vida do jogador (parece que aqui o código está zerando a vida do jogador, pois faz `vidaJogador -= vidaJogador`)
// Se isso for intencional, mantém; se for erro, deve ajustar
vidaJogador -= vidaJogador;
await db.set(`vida_${userId}`, vidaJogador);

const embed = new EmbedBuilder()
  .setTitle("💢 Contra-ataque do NPC")
  .setColor("Red")
  .setDescription(
    `${boss.nome} usou **${habilidade.nome}** **informação: ${habilidade.descricao}** e causou **${habilidade.dano}** de dano.`
  )
  .addFields(
    { name: "💚 Sua Vida", value: gerarBarraDeVida(vidaJogador, 150), inline: true },
    { name: "❤️ Vida do NPC", value: gerarBarraDeVida(bossvida, boss.vida), inline: true },
    { name: "💬 NPC:", value: boss.falaAtaque || "Você não vai escapar tão fácil!" }
  );

await message.channel.send({ embeds: [embed] });

if (vidaJogador <= 0) {
  return message.channel.send("💀 Você foi derrotado.");
}

// Reduz cooldowns do jogador
for (let key in cooldowns) {
  if (cooldowns[key] > 0) cooldowns[key]--;
}

// Regenera stamina do jogador
staminaJogador = Math.min(100, staminaJogador + 10);

return turnoJogador();
}
}
    }
 await iniciarCombate(); 
    console.log("combate iniciado")
  
}// Fim do module.exports
 
  }
