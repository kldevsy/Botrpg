const { QuickDB } = require("quick.db");
const db = new QuickDB();

const {
  EmbedBuilder,
} = require("discord.js");

const frutas = require("../frutas.json");
const equipamentos = require("../equipamentos.json");
const espadas = require("../espadas.json");
const npcs = require("../npcs.json");
const quests = require("../quests.json");
const hb = require("../Habilidades.json");

function gerarBarraDeVida(vidaAtual, vidaMaxima, blocos = 10) {
  const porcentagem = Math.max(0, Math.min(vidaAtual / vidaMaxima, 1));
  const blocosCheios = Math.round(porcentagem * blocos);
  const blocosVazios = blocos - blocosCheios;
  const barra = "🟩".repeat(blocosCheios) + "🟥".repeat(blocosVazios);
  return `${barra} ${Math.floor(porcentagem * 100)}%`;
}

function calcularDanoBase(
  habilidade,
  forca,
  danoEquipamento,
  upgradeEspada,
  danohaki
) {
  const danoBruto = habilidade.dano || 0;
  const bonusUpgrade = upgradeEspada * 2;
  return Math.floor(danoBruto * 0.75 + forca + danoEquipamento + bonusUpgrade);
}

module.exports = {
  name: 'combate',
  description: 'Mostra o ping do bot com detalhes',

  async execute(message) {
  const userId = message.author.id;
  const serverId = message.guild.id;

  const criado = await db.get(`criado_${userId}`);
  if (!criado)
    return message.channel.send(
      "Você ainda não criou seu personagem! Use !iniciar."
    );

  const upgradeEspada = (await db.get(`upgrade_espada_${userId}`)) || 0;
  const questId = await db.get(`quest_${userId}`);
  if (!questId)
    return message.channel.send(
      "Você não tem uma quest ativa. Use !missao para pegar uma nova."
    );

  const quest = quests.quests.find((q) => q.id === questId);
  if (!quest) return message.channel.send("Quest não encontrada.");

  const npcsDaQuest = quest.npcId.map((id) =>
    npcs.npcs.find((n) => n.id === id)
  );
  if (!npcsDaQuest.length)
    return message.channel.send("Não há NPCs para enfrentar nesta quest.");

  let indexNpc = 0;
  let vidaJogador = (await db.get(`vida_${userId}`)) || 100;
  let staminaJogador = 100;
  const cooldowns = {};
  let npcStun = 0;
  let v = 5;
  let buff = 0;
  let fcc = 0;
  let nomeform = `oi`;
  let dur = 0;
  let text = `nenhum`;

  const npc = JSON.parse(JSON.stringify(npcsDaQuest[indexNpc]));

  async function iniciarCombate() {
    if (indexNpc >= npcsDaQuest.length) {
      await db.delete(`quest_${userId}`);
      await db.add(`xp_${userId}`, quest.recompensa.xp);
      await db.add(`berries_${userId}`, quest.recompensa.berries);

      if (quest.bau === `normal`) {
        const chance = Math.random();
        if (chance === 0.35) {
          await db.add(`comum_${userId}`, 1);
          text = `bau ${quest.bau}`;
        } else {
          text = `nenhum`;
        }
      }
      if (quest.bau === `raro`) {
        const chance = Math.random();
        if (chance === 0.25) {
          await db.add(`raro_${userId}`, 1);
          text = `bau ${quest.bau}`;
        } else {
          text = `nenhum`;
        }
      }
      if (quest.bau === `epico`) {
        const chance = Math.random();
        if (chance === 0.1) {
          await db.add(`epico_${userId}`, 1);
          text = `bau ${quest.bau}`;
        } else {
          text = `nenhum`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle("🏆 Inimigos derrotado!")
        .setColor("Green")
        .setDescription(
          `**Recompensas:**\n+${quest.recompensa.xp}(+${npc.recompensa.xp}) XP\n+${quest.recompensa.berries}(+${npc.recompensa.berries}) Berries${
            npc.xpfruit ? `\n+${npc.xpfruit} XP de Fruta\nbaus:${text}` : ""
          }`
        )
        .addFields({
          name: "🗣️ Últimas palavras do inimigo",
          value: npc.falaDerrota || "Arghhh...",
        });

      await message.channel.send({ embeds: [embed] });
      return message.channel.send("✅ Você completou a missão!");
    }

const espadaId = await db.get(`espada_${userId}`);
const espada = espadas.espadas.find((e) => e.id === espadaId);
const habilidadesEspada = espada?.habilidades || [];

const frutaId = await db.get(`fruta_equipada_${userId}`);
let fruta = null;

if (frutaId) {
  fruta = frutas.frutas.find((f) => f.id === frutaId.id);
}

const frutaNivel = (await db.get(`fruta_nivel_${userId}_${frutaId?.id}`)) || 1;

const habilidadesFruta =
  fruta?.habilidades?.filter((h) => h.nivel <= frutaNivel) || [];

const form =
  fruta?.transformação && Array.isArray(fruta.transformação)
    ? fruta.transformação.filter((h) => h.nivel <= frutaNivel)
    : [];

const carga = (await db.get(`gorocarga_${userId}_${frutaId?.id}`)) || 1.5;

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

const hakiID = `haki`;
const hk = hb.habilidades.find((f) => f.id === hakiID);
const hkab = hk?.hab?.filter((h) => h.nivel <= 1) || [];

console.log(hkab);

const equipamentoId = await db.get(`equipamento_${userId}`);
const equipamento = equipamentos.equipamentos.find(
  (e) => e.id === equipamentoId
);

const forca = (await db.get(`forca_${userId}`)) || 10;
const danoEquipamento = 0;

let vidaNpc = npc.vida;
const berserkerTrigger = npc.vida * 0.3;

const habilidades = [
  ...habilidadesEspada,
  ...habilidadesFruta,
  ...form,
  ...hkab,
];

if (habilidades.length === 0)
  return message.channel.send("Você não possui habilidades para lutar.");

console.log(`count`, npcsDaQuest.length);

const embed = new EmbedBuilder()
  .setTitle(`⚔️ Início do Combate: ${npc.nome}`)
  .setDescription(npc.descricao)
  .setColor("Orange")
  .addFields({
    name: "💬 Fala do inimigo",
    value: npc.falaInicio || "Prepare-se!",
  });

await message.channel.send({ embeds: [embed] });
    

async function turnoJogador() {
  const habilidadesDisponiveis = habilidades.filter((h, i) => {
    const id = `${h.nome}_${i}`;
    const emCooldown = cooldowns[id] && cooldowns[id] > 0;
    return !emCooldown && h.custoStamina <= staminaJogador;
  });

  if (habilidadesDisponiveis.length === 0) {
    await message.channel.send("⚠️ Sem habilidades disponíveis no momento. Turno pulado.");
    return await turnoNpc();
  }

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
    return await message.channel
      .send("🌀 Você está atordoado e perdeu o turno!")
      .then(() => turnoNpc());
  }

  const embed = new EmbedBuilder()
    .setTitle("🔢 Escolha sua habilidade")
    .setColor("Gold")
    .setDescription(
      habilidadesDisponiveis
        .map(
          (h, i) =>
            `\`${i + 1}\` - **${h.nome}**: ${h.descricao} (Stamina: ${h.custoStamina}, CD: ${h.cooldown})`
        )
        .join("\n")
    )
    .addFields(
      { name: "💚 Vida", value: gerarBarraDeVida(vidaJogador, 150), inline: true },
      { name: "⚡ Stamina", value: `${staminaJogador}/100`, inline: true }
    )
    .setFooter({ text: "Digite o número da habilidade ou 'cancelar' para desistir." });

  await message.channel.send({ embeds: [embed] });

  const filtro = (m) => m.author.id === userId;
  const coletor = message.channel.createMessageCollector({ filter: filtro, max: 1, time: 30000 });

  coletor.on("collect", async (msg) => {
    if (msg.content.toLowerCase() === "cancelar") {
      await db.delete(`quest_${userId}`);
      return msg.channel.send("❌ Você cancelou a missão.");
    }

    const index = parseInt(msg.content) - 1;
    const habilidade = habilidadesDisponiveis[index];
    if (!habilidade) {
      await msg.channel.send("Número inválido.");
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

      if (habilidade.nome === `gear second`) {
        const base = forca;
        const porcentagem = habilidade.buff;
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
        .setDescription(`Você usou **${habilidade.nome}**!\n\n${habilidade.descricao}`);

      if (habilidade.imagem) {
        embed2.setImage(habilidade.imagem);
      }

      await msg.channel.send({ embeds: [embed2] });
      return turnoNpc();
    } else {
      // habilidade de dano
      let fc2 = forca;
      if (habilidade.nome === `haki`) dur = 10;

      if (dur > 0 && habilidade.tipo === `espada`) {
        const base = forca;
        const porcentagem = habilidade.dano;
        fc2 = Math.ceil(base + base * (porcentagem / 100));
      }

      if (dur > 0) dur--;

      let danoFinal = 0;
      if (npc.anti === `logia`) {
        if (habilidade.tipo === `espada` && dur <= 0) {
          danoFinal = 0;
          await msg.reply("npc com logia ativa");
        } else {
          danoFinal = calcularDanoBase(habilidade, forca + fc2, danoEquipamento, upgradeEspada);
        }
      } else {
        danoFinal = calcularDanoBase(habilidade, forca + fc2, danoEquipamento, upgradeEspada);
      }

      if (v <= 0) {
        buff = 0;
      }

      if (v > 0) {
        v--;
        if (habilidade.tipo !== `espada`) {
          danoFinal += buff;
        }
      }

      vidaNpc -= danoFinal;

      if (habilidade.burn) {
        if (!npc.efeitosAtivos) npc.efeitosAtivos = [];
        npc.efeitosAtivos.push({
          tipo: "burn",
          dano: habilidade.burn.danoPorTurno,
          turnosRestantes: habilidade.burn.turnos,
          origem: userId,
        });
      }

      if (
        habilidade.efeitoEspecial &&
        habilidade.efeitoEspecial.tipo === "shock"
      ) {
        if (!npc.efeitosAtivos) npc.efeitosAtivos = [];
        npc.efeitosAtivos.push({
          tipo: "shock",
          chanceFalha: habilidade.efeitoEspecial.chanceFalharProximoTurno || 0.3,
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
    danoFinal += detalhes.dano;
    // Aplicar dano ao NPC continua normalmente
  }
} else {
  name = habilidade.nome;
}

if (habilidade.stun) {
  npcStun = habilidade.stun;
  console.log(habilidade.stun);
}
const nm = `💚 Vida`;
await message.channel.send({
  embeds: [
    new EmbedBuilder()
      .setTitle(`💥 ${name}`)
      .setColor("#2ecc71")
      .setDescription(
        `Você causou **${danoFinal}** de dano com o movimento: **${habilidade.descricao}**!`
      )
      .addFields(
        {
          name: "❤️ Vida do NPC",
          value: gerarBarraDeVida(vidaNpc, npc.vida),
          inline: true,
        },
        {
          name: `${nm}`,
          value: gerarBarraDeVida(vidaJogador, 150),
          inline: true,
        },
        {
          name: "⚡ Stamina",
          value: `${staminaJogador}/100`,
          inline: true,
        }
      ),
  ],
});

if (vidaNpc <= 0) {
  await db.add(`xp_${userId}`, npc.recompensa.xp);
  await db.add(`berries_${userId}`, npc.recompensa.berries);

  if (npc.xpfruit) {
    await db.add(`fruta_xp_${userId}_${frutaId.id}`, npc.xpfruit);
  }

  if (indexNpc >= npcsDaQuest.length) {
    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏆 Inimigos derrotados!")
          .setColor("Green")
          .setDescription(
            `**Recompensas:**\n+${quest.recompensa.xp}(+${
              npcsDaQuest.length * npc.recompensa.xp
            }) XP\n+${quest.recompensa.berries}(+${
              npcsDaQuest.length * npc.recompensa.berries
            }) Berries${
              npc.xpfruit
                ? `\n+${npc.xpfruit} XP de Fruta\nbaús: ${text}`
                : ""
            }`
          )
          .addFields({
            name: "🗣️ Últimas palavras do inimigo",
            value: npc.falaDerrota || "Arghhh...",
          }),
      ],
    });
  } else {
    const count = indexNpc === 0 ? 1 : indexNpc;
    console.log(count);

    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏆 Inimigo derrotado!")
          .setColor("Green")
          .setDescription(
            `**Você derrotou um inimigo ${count}/${npcsDaQuest.length}**`
          )
          .addFields({
            name: "🗣️ Últimas palavras do inimigo",
            value: npc.falaDerrota || "Arghhh...",
          }),
      ],
    });
  }

  indexNpc++;
  return iniciarCombate(); // próximo inimigo
}

await turnoNpc();
    
    }
  });
  coletor.on("end", async (c) => {
  if (c.size === 0) {
    await message.channel.send("⏰ Tempo esgotado. O combate foi cancelado.");
  }
    });
}


  async function turnoNpc() {
  if (npcStun > 0) {
    npcStun--;
    await message.channel.send("🌀 O inimigo está atordoado e perdeu o turno!");
    return turnoJogador();
  }

  if (!npc.efeitosAtivos) npc.efeitosAtivos = [];

  for (const efeito of npc.efeitosAtivos) {
    if (efeito.tipo === "burn" && efeito.turnosRestantes > 0) {
      npc.vida -= efeito.dano;
      const full = frutaNivel * efeito.dano;
      await db.subtract(`boss_ativo_${serverId}.vida`, full);
      efeito.turnosRestantes--;
      console.log(`🔥 O boss sofreu ${efeito.dano} de queimadura!`);
    }
  }

  npc.efeitosAtivos = npc.efeitosAtivos.filter((e) => e.turnosRestantes > 0);

  let impedirAtaque = false;
  for (const efeito of npc.efeitosAtivos) {
    if (efeito.tipo === "shock" && efeito.turnosRestantes > 0) {
      if (Math.random() < efeito.chanceFalha) {
        impedirAtaque = true;
        console.log("⚡ O boss ficou paralisado pelo choque e perdeu a vez!");
      }
      efeito.turnosRestantes--;
    }
  }

  npc.efeitosAtivos = npc.efeitosAtivos.filter((e) => e.turnosRestantes > 0);

  if (impedirAtaque) {
    await message.channel.send("🌀 O inimigo está atordoado e perdeu o turno!");
    return turnoJogador();
  }

  if (!npc.cooldowns) npc.cooldowns = {};
  if (npc.staminaAtual === undefined) npc.staminaAtual = 100;

  const habilidadesDisponiveis = npc.habilidades.filter((hab) => {
    const emCooldown = npc.cooldowns[hab.nome] > 0;
    const temStamina = npc.staminaAtual >= hab.custoStamina;
    return !emCooldown && temStamina;
  });

  let habilidade;
  if (habilidadesDisponiveis.length > 0) {
    habilidade = habilidadesDisponiveis[Math.floor(Math.random() * habilidadesDisponiveis.length)];
    npc.staminaAtual -= habilidade.custoStamina;
    npc.cooldowns[habilidade.nome] = habilidade.cooldown;
  } else {
    habilidade = {
      nome: "Ataque Selvagem",
      descricao: "Um ataque comum e desesperado.",
      dano: 3000,
      stun: false,
    };
  }

  for (const nome in npc.cooldowns) {
    if (npc.cooldowns[nome] > 0) npc.cooldowns[nome]--;
  }

  let dano = npc.dano;

  if (vidaNpc <= berserkerTrigger) {
    dano *= 2;
    habilidade.nome += " (BERSERKER)";
  }

  let defesaTemp = await db.get(`defesa_temporaria_${userId}`);
  if (defesaTemp) {
    dano = Math.floor(dano / 2);
    defesaTemp--;
    if (defesaTemp <= 0) await db.delete(`defesa_temporaria_${userId}`);
    else await db.set(`defesa_temporaria_${userId}`, defesaTemp);
  }

  vidaJogador -= dano;
  await db.set(`vida_${userId}`, vidaJogador);

  await message.channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("💢 Contra-ataque do NPC")
        .setColor("Red")
        .setDescription(
          `${npc.nome} usou **${habilidade.nome}**!\nMovimento: ${habilidade.descricao}\nCausou **${dano}** de dano.`
        )
        .addFields(
          {
            name: "💚 Sua Vida",
            value: gerarBarraDeVida(vidaJogador, 150),
            inline: true,
          },
          {
            name: "❤️ Vida do NPC",
            value: gerarBarraDeVida(vidaNpc, npc.vida),
            inline: true,
          },
          {
            name: "💬 NPC:",
            value: npc.falaAtaque || "Você não vai escapar tão fácil!",
          }
        ),
    ],
  });

  if (vidaJogador <= 0) {
    await db.delete(`quest_${userId}`);
    return message.channel.send("💀 Você foi derrotado.");
  }

  for (let key in cooldowns) {
    if (cooldowns[key] > 0) cooldowns[key]--;
  }

  staminaJogador = Math.min(100, staminaJogador + 10);

  return turnoJogador();
  }
  

    
  turnoJogador();
        
  }
iniciarCombate();
  // Continua o resto do combate aqui...
}
};