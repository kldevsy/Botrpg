module.exports = {
  name: 'ping',
  description: 'Mostra o ping do bot com detalhes',

  async execute(message) {
    const sent = await message.reply('🏓 Calculando ping...');

    const gatewayPing = message.client.ws.ping;
    const apiPing = sent.createdTimestamp - message.createdTimestamp;

    const shardId = message.client.shard ? message.client.shard.ids[0] + 1 : 1;
    const totalShards = message.client.shard ? message.client.shard.count : 1;

    const clusterNumber = 16;
    const clusterName = 'Underworld';

    await sent.edit(`🏓 **|** **Pong!** (📡 Shard ${shardId}/${totalShards}) (Bot Cluster ${clusterNumber} \`${clusterName}\`) **|** **Gateway Ping:** \`${gatewayPing}ms\` **|** **API Ping:** \`${apiPing}ms\``);
  }
};
