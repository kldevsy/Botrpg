const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('node:fs');
require('dotenv').config();
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const bossSpawnLoop = require("./bossSpawnLoop");
const { atualizarIlhas } = require("./utils/atualizarIlhas");
const { distribuirLucros } = require("./utils/lucros");
const { processarResultado } = require("./utils/resultado");





const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

client.commands = new Collection();
client.aliases = new Collection();

// Carrega os comandos da pasta /commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (command.name && typeof command.execute === 'function') {
    client.commands.set(command.name, command);
    if (Array.isArray(command.aliases)) {
      for (const alias of command.aliases) {
        client.aliases.set(alias, command.name);
      }
    }
  } else {
    console.warn(`⚠️ Comando mal formatado ignorado: ${file}`);
  }
}

// Sistema de contagem de mensagens e execução de comandos
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const channelId = message.channel.id;
  const userId = message.author.id;

  const config = await db.get(`msgcount_config_${guildId}`) || { ativo: false };
  if (config.ativo) {
    await db.add(`msgcount_${guildId}_${userId}`, 1);
    await db.add(`msgcount_${guildId}_${channelId}_${userId}`, 1);
    await db.add(`msgcount_global_${userId}`, 1);
  }

  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
  if (!command) return;

  try {
    await command.execute(message, args, client);
  } catch (error) {
    console.error(`Erro ao executar comando ${commandName}:`, error);
    message.reply('❌ Ocorreu um erro ao executar este comando.');
  }
});

// Interações com botões
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  try {
    const [cmdName, action, ...rest] = interaction.customId.split(':');
    const command = client.commands.get(cmdName);

    if (command && typeof command.button === 'function') {
  await command.button(interaction, { action, rest, client });
  return;
    }

    // Botões legados do sistema de contador
    if (cmdName === 'contador') {
      const guildId = interaction.guild?.id;
      const configKey = `msgcount_config_${guildId}`;

      if (action === 'ativar') {
        await db.set(configKey, { ativo: true });
        return interaction.reply({ content: '✅ Contador de mensagens **ativado**.', ephemeral: true });
      }

      if (action === 'desativar') {
        await db.set(configKey, { ativo: false });
        return interaction.reply({ content: '❌ Contador de mensagens **desativado**.', ephemeral: true });
      }

      if (action === 'resetar') {
        const entries = await db.all();
        for (const entry of entries) {
          if (entry.id.startsWith(`msgcount_${guildId}_`)) {
            await db.delete(entry.id);
          }
        }
        return interaction.reply({ content: '🔄 Contador resetado com sucesso.', ephemeral: true });
      }
    }

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "⚠️ Este botão não é mais válido ou não foi reconhecido.",
        ephemeral: true
      });
    }

  } catch (err) {
    console.error("❌ Erro ao lidar com botão:", err);

    if (err.code === 10062 || err.message?.includes("Unknown interaction")) return;

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Ocorreu um erro ao processar esta interação.',
        ephemeral: true
      });
    }
  }
});

client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  console.log(`testando`);
// Atualizar ao iniciar
  atualizarIlhas(client);
 // Para testar manualmente:
distribuirLucros();
  
  // Executa imediatamente uma vez ao iniciar o bot
processarResultado(client).then(() => {
  console.log("✅ Resultado da roleta inicial processado.");
}).catch(console.error);
  
  
  // Executa a cada 5 minutos
setInterval(async () => {
  console.log("⏳ Iniciando rodada de roleta...");
  try {
    await processarResultado(client);
  } catch (err) {
    console.error("❌ Erro ao processar resultado da roleta:", err);
  }
}, 5 * 60 * 1000);

// Executa a cada 1 hora
setInterval(distribuirLucros, 1000 * 60 * 60);

  // Atualizar a cada 1 hora
  setInterval(() => atualizarIlhas(client), 60 * 60 * 1000);
});
bossSpawnLoop(client);
client.login(process.env.TOKEN);