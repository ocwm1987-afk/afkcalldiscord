require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;
const channelId = process.env.CHANNEL_ID;

if (!token || !guildId || !channelId) {
  console.error("Missing DISCORD_TOKEN, GUILD_ID, or CHANNEL_ID environment variable.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let reconnectTimer;

function connectToVoice() {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.error("Guild not found. Check GUILD_ID and make sure the bot is in that server.");
    return;
  }

  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isVoiceBased()) {
    console.error("Voice channel not found. Check CHANNEL_ID.");
    return;
  }

  const existing = getVoiceConnection(guildId);
  if (existing) existing.destroy();

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: true,
  });

  connection.on(VoiceConnectionStatus.Ready, () => {
    console.log(`Connected to voice channel: ${channel.name}`);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    console.warn("Voice connection disconnected; attempting to reconnect...");
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      console.log("Voice connection is reconnecting.");
    } catch {
      connection.destroy();
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectToVoice, 5_000);
    }
  });

  connection.on("error", (error) => {
    console.error("Voice connection error:", error);
  });
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  connectToVoice();
});

client.on("error", (error) => console.error("Discord client error:", error));

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

client.login(token);
