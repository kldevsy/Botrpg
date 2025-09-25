const { EmbedBuilder } = require("discord.js");
const { QuickDB } = require("quick.db");
const bosses = require("./bosses.json");

const db = new QuickDB();

module.exports = async (client) => {
  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      const guildId = guild.id;

      // ID do canal fixo onde o boss será anunciado
      const canalId = `725984872438562836`;
      const canal = client.channels.cache.get(canalId);
      if (!canal) continue;

      // Verifica se já há um boss ativo
      const bossAtivo = await db.get(`boss_ativo_${guildId}`);
      if (bossAtivo) continue;

      // Filtra bosses com base na chance de aparição
      const candidatos = bosses.bosses.filter(b => Math.random() * 100 < b.chanceAparicao);
      if (!candidatos.length) continue;

      const boss = candidatos[Math.floor(Math.random() * candidatos.length)];

      const bossData = {
        id: boss.id,
        nome: boss.nome,
        descricao: boss.descricao,
        vida: boss.vida,
        vidaAtual: boss.vida,
        habilidades: boss.habilidades,
        inicio: Date.now(),
        expiracao: Date.now() + (boss.tempoLimite || 3600000),
        danoPorJogador: {},
        stun: {},
        cooldowns: {},
        formaAlternativa: boss.formaAlternativa || null,
        formaAtiva: 0
      };

      await db.set(`boss_ativo_${guildId}`, bossData);

      const embed = new EmbedBuilder()
        .setTitle(`**Evento Boss Global: ${boss.nome} apareceu!**`)
        .setDescription(`${boss.descricao}\n\nUse \`!atacar\` para combater o boss.\n\n**Tempo limite:** 1 hora\n**Vida:** ${boss.vida.toLocaleString("pt-BR")}`)
        .setColor("Red");

      if (boss.thumbnail) embed.setThumbnail(boss.thumbnail);
      if (boss.notificavel) embed.setFooter({ text: "Reaja com 🔔 para ser notificado nos próximos spawns." });

      canal.send({ embeds: [embed] });
    }
  }, 1000); // A cada 30 minutos
};