import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';

import { config } from './config.js';
import { handleAdminCommand } from './admin.js';

import qrcode from 'qrcode-terminal';
import pino from 'pino';

const PREFIX = config.prefix;
const BOT_NAME = config.botName;

const ADMIN_COMMANDS = [
  'admin', 'add', 'kick', 'promote',
  'demote', 'block', 'unblock',
  'tagall', 'hidetag', 'mute',
  'unmute', 'groupinfo'
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

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('SCAN QR CODE WITH WHATSAPP');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log(`${BOT_NAME} CONNECTED!`);
    }

    if (connection === 'close') {
      const status =
        lastDisconnect?.error?.output?.statusCode;

      if (status !== DisconnectReason.loggedOut) {
        console.log('Reconnecting...');
        startBot().catch(console.error);
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
        '';

      if (!message.startsWith(PREFIX)) continue;

      const args = message.slice(PREFIX.length)
        .trim().split(/\s+/);

      const command = args.shift()?.toLowerCase();

      if (!command) continue;

      try {

        if (ADMIN_COMMANDS.includes(command)) {
          await handleAdminCommand(
            sock,
            msg,
            command,
            args,
            config
          );
          continue;
        }

        switch (command) {

          case 'menu':
            await sock.sendMessage(jid, {
              text: `
╭━━━━━━━━━━━━━━━━━━━━╮
     🤖 ${BOT_NAME}
╰━━━━━━━━━━━━━━━━━━━━╯

👑 OWNER
.owner
.alive
.ping

👥 GROUP MANAGEMENT
.admin
.add
.kick
.promote
.demote
.block
.unblock
.tagall
.hidetag
.mute
.unmute
.groupinfo

🎨 MEDIA
.sticker
.toimg
.vv

⚙️ AUTOMATION
.autoread
.autoreact
.welcome
.goodbye

╭━━━━━━━━━━━━━━━━━━━━╮
       POWERED BY MACHALA
╰━━━━━━━━━━━━━━━━━━━━╯
`
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
              text: `👑 Owner: ${config.ownerName}`
            });
            break;

          case 'vv':
            await sock.sendMessage(jid, {
              text: '👁️ View Once privacy is respected. Eligible media you own or have permission to retain can be handled separately.'
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
