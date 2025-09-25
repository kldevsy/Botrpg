const { QuickDB } = require('quick.db');
const db = new QuickDB();

async function aplicarBuffs(userId, guildId, categoria, valorBase) {
  let multiplicador = 1;
  const agora = Date.now();

  const fontes = {
    usuario: `buff${categoria}_${userId}`,
    guilda: `guildbuff${categoria}_${guildId}`,
    evento: `eventbuff${categoria}`,
    permanente: `permabuff${categoria}_${userId}`
  };

  for (const tipo in fontes) {
    const chave = fontes[tipo];
    const buff = await db.get(chave);

    if (buff && buff.aumento) {
      if (tipo === "permanente") {
        multiplicador *= parseFloat(buff.aumento);
      } else if (!buff.expira || buff.expira > agora) {
        multiplicador *= parseFloat(buff.aumento);
      } else {
        await db.delete(chave); // remove buff expirado
      }
    }
  }

  return Math.floor(valorBase * multiplicador);
}

module.exports = { aplicarBuffs };