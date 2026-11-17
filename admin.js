const GROUP_COMMANDS = [
  'admin',
  'kick',
  'add',
  'promote',
  'demote',
  'tagall',
  'hidetag',
  'mute',
  'unmute',
  'groupinfo'
];

const OWNER_COMMANDS = [
  'block',
  'unblock'
];

function getNumber(jid = '') {
  return jid.split('@')[0].split(':')[0].replace(/\D/g, '');
}

function isAdmin(participant) {
  return (
    participant?.admin === 'admin' ||
    participant?.admin === 'superadmin'
  );
}

function getSender(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

function getTargets(msg, args) {
  const mentioned =
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

  if (mentioned.length) {
    return mentioned;
  }

  const number = (args[0] || '').replace(/\D/g, '');

  if (number.length >= 7) {
    return [`${number}@s.whatsapp.net`];
  }

  return [];
}

export async function handleAdminCommand(
  sock,
  msg,
  command,
  args,
  config
) {
  const jid = msg.key.remoteJid;
  const isGroup = jid.endsWith('@g.us');
  const sender = getSender(msg);

  const ownerNumber = getNumber(config.ownerNumber || '');

  const isOwner =
    ownerNumber !== '' &&
    getNumber(sender) === ownerNumber;

  if (!GROUP_COMMANDS.includes(command) &&
      !OWNER_COMMANDS.includes(command)) {
    return false;
  }

  if (OWNER_COMMANDS.includes(command) && !isOwner) {
    await sock.sendMessage(jid, {
      text: '⛔ Only the bot owner can use this command.'
    });
    return true;
  }

  if (GROUP_COMMANDS.includes(command) && !isGroup) {
    await sock.sendMessage(jid, {
      text: '❌ This command only works in groups.'
    });
    return true;
  }

  try {
    if (OWNER_COMMANDS.includes(command)) {
      const targets = getTargets(msg, args);

      if (!targets.length) {
        await sock.sendMessage(jid, {
          text: `Usage: .${command} 234XXXXXXXXXX`
        });
        return true;
      }

      for (const target of targets) {
        await sock.updateBlockStatus(
          target,
          command === 'block' ? 'block' : 'unblock'
        );
      }

      await sock.sendMessage(jid, {
        text: `✅ Contact ${command === 'block' ? 'blocked' : 'unblocked'}.`
      });

      return true;
    }

    const metadata = await sock.groupMetadata(jid);

    const senderParticipant = metadata.participants.find(
      p => p.id === sender
    );

    const botNumber = getNumber(sock.user?.id || '');

    const botParticipant = metadata.participants.find(
      p => getNumber(p.id) === botNumber
    );

    const senderAdmin = isAdmin(senderParticipant);
    const botAdmin = isAdmin(botParticipant);

    if (
      command !== 'admin' &&
      !isOwner &&
      !senderAdmin
    ) {
      await sock.sendMessage(jid, {
        text: '⛔ Group administrators only.'
      });
      return true;
    }

    const adminOnly = [
      'kick',
      'add',
      'promote',
      'demote',
      'tagall',
      'hidetag',
      'mute',
      'unmute'
    ];

    if (adminOnly.includes(command) && !botAdmin) {
      await sock.sendMessage(jid, {
        text: '⚠️ Make the bot a group administrator first.'
      });
      return true;
    }

    switch (command) {

      case 'admin': {
        const admins = metadata.participants.filter(
          p => p.admin
        );

        const mentions = admins.map(p => p.id);

        const list = admins.map(
          (p, i) =>
            `${i + 1}. @${p.id.split('@')[0]}`
        ).join('\n');

        await sock.sendMessage(jid, {
          text: `👑 GROUP ADMINS\n\n${list || 'No administrators found.'}`,
          mentions
        });

        break;
      }

      case 'kick':
      case 'add':
      case 'promote':
      case 'demote': {
        const targets = getTargets(msg, args);

        if (!targets.length) {
          await sock.sendMessage(jid, {
            text: `Usage: .${command} @user`
          });
          break;
        }

        const action =
          command === 'kick' ? 'remove' : command;

        await sock.groupParticipantsUpdate(
          jid,
          targets,
          action
        );

        await sock.sendMessage(jid, {
          text: `✅ ${command.toUpperCase()} command processed.`
        });

        break;
      }

      case 'tagall':
      case 'hidetag': {
        const members = metadata.participants.map(
          p => p.id
        );

        await sock.sendMessage(jid, {
          text: args.join(' ') || '📢 Attention everyone!',
          mentions: members
        });

        break;
      }

      case 'mute':
      case 'unmute': {
        await sock.groupSettingUpdate(
          jid,
          command === 'mute'
            ? 'announcement'
            : 'not_announcement'
        );

        await sock.sendMessage(jid, {
          text: command === 'mute'
            ? '🔇 Group muted.'
            : '🔊 Group unmuted.'
        });

        break;
      }

      case 'groupinfo': {
        await sock.sendMessage(jid, {
          text:
            `📊 GROUP INFORMATION\n\n` +
            `Name: ${metadata.subject}\n` +
            `Members: ${metadata.participants.length}\n` +
            `Description: ${metadata.desc || 'None'}`
        });

        break;
      }
    }

    return true;

  } catch (error) {
    console.error('Admin command error:', error);

    await sock.sendMessage(jid, {
      text: '❌ Command failed. Check bot permissions and try again.'
    });

    return true;
  }
}
