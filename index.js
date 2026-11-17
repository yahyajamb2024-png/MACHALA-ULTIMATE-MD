import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';

import { config } from './config.js';
import { handleAdminCommand } from './admin.js';
import pino from 'pino';

const PREFIX = config.prefix;
const BOT_NAME = config.botName;

const ADMIN_COMMANDS = [
  'admin', 'add', 'kick', 'promote', 'demote',
  'block', 'unblock', 'tagall', 'hidetag',
  'mute', 'unmute', 'groupinfo'
];

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState('./session');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    markOnlineOnConnect: false
  });

  sock.ev.on('creds.update', saveCreds);

  let pairingRequested = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !state.creds.registered && !pairingRequested) {
      pairingRequested = true;

      try {
        const phoneNumber = (config.ownerNumber || '')
          .replace(/\D/g, '');

        if (!phoneNumber) {
          console.log('ERROR: Set OWNER_NUMBER in Render Environment.');
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        const code = await sock.requestPairingCode(phoneNumber);

        console.log('================================');
        console.log('MACHALA ULTIMATE PAIRING CODE');
        console.log(code);
        console.log('================================');

      } catch (error) {
        pairingRequested = false;
        console.error('Pairing error:', error);
      }
    }

    if (connection === 'open') {
      console.log(`${BOT_NAME} CONNECTED SUCCESSFULLY!`);
    }

    if (connection === 'close') {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (statusCode !== DisconnectReason.loggedOut) {
        console.log('Reconnecting...');
        startBot();
      } else {
        console.log('WhatsApp session logged out.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;

      if (!jid || jid === 'status@broadcast') continue;

      const message =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        '';

      if (!message.startsWith(PREFIX)) continue;

      const args = message.slice(PREFIX.length).trim().split(/\s+/);
      const command = args.shift()?.toLowerCase();

      if (!command) continue;

      try {
        if (ADMIN_COMMANDS.includes(command)) {
          await handleAdminCommand(
            sock, msg, command, args, config
          );
          continue;
        }

        switch (command) {
          case 'menu':
            await sock.sendMessage(jid, {
              text:
`╭━━━━━━━━━━━━━━━━━━╮
     🤖 ${BOT_NAME}
╰━━━━━━━━━━━━━━━━━━╯

👑 OWNER
.owner

⚙️ BASIC COMMANDS
.menu
.alive
.ping

👥 GROUP MANAGEMENT
.admin
.add
.kick
.promote
.demote
.tagall
.hidetag
.mute
.unmute
.groupinfo

🎨 MEDIA TOOLS
.vv

╭━━━━━━━━━━━━━━━━━━╮
     POWERED BY MACHALA
╰━━━━━━━━━━━━━━━━━━╯`
            });
            break;

          case 'alive':
            await sock.sendMessage(jid, {
              text: `✅ ${BOT_NAME} is online!`
            });
            break;

          case 'ping':
            await sock.sendMessage(jid, {
              text: '🏓 MACHALA ULTIMATE is responding!'
            });
            break;

          case 'owner':
            await sock.sendMessage(jid, {
              text: `👑 Bot Owner: ${config.ownerName}`
            });
            break;

          case 'vv':
          case 'vv2':
            await sock.sendMessage(jid, {
              text: '👁️ View Once media is protected. I can help with media you own or have permission to retain.'
            });
            break;

          default:
            await sock.sendMessage(jid, {
              text: '❌ Unknown command. Type .menu'
            });
        }

      } catch (error) {
        console.error('Command error:', error);
      }
    }
  });
}

startBot().catch(console.error);
