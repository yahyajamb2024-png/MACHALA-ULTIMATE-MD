const GROUP_COMMANDS = [
‘admin’, ‘kick’, ‘add’, ‘promote’,
‘demote’, ‘tagall’, ‘hidetag’,
‘mute’, ‘unmute’, ‘groupinfo’
];

const BOT_ADMIN_COMMANDS = [
‘kick’, ‘add’, ‘promote’,
‘demote’, ‘mute’, ‘unmute’
];

const OWNER_ONLY_COMMANDS = [‘block’, ‘unblock’];

function sendReply(sock, jid, text, options = {}) {
return sock.sendMessage(jid, { text, …options });
}

function getSender(msg) {
return msg.key.participant || msg.key.remoteJid;
}

function getSenderNumber(sender) {
return sender.split(’@’)[0].split(’:’)[0];
}

function getOwnerNumber(config) {
return (config.ownerNumber || ‘’).replace(/\D/g, ‘’);
}

function isGroupJid(jid) {
return jid.endsWith(’@g.us’);
}

function isAdmin(participant) {
return participant?.admin === ‘admin’ ||
participant?.admin === ‘superadmin’;
}

function getMentionedJids(msg) {
return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

function resolveTargets(msg, args) {
const mentioned = getMentionedJids(msg);

if (mentioned.length) {
return mentioned;
}

const number = args[0]?.replace(/\D/g, ‘’);

return number && number.length >= 7
? [${number}@s.whatsapp.net]
: [];
}

function getParticipant(metadata, jid) {
return metadata?.participants.find(
participant => participant.id === jid
);
}

function getBotJid(sock) {
return ${sock.user.id.split(':')[0]}@s.whatsapp.net;
}

function getPermissionState(sock, metadata, sender, config) {
const senderNumber = getSenderNumber(sender);
const ownerNumber = getOwnerNumber(config);

const isOwner = Boolean(
ownerNumber && senderNumber === ownerNumber
);

const senderIsAdmin = isAdmin(
getParticipant(metadata, sender)
);

const botIsAdmin = isAdmin(
getParticipant(metadata, getBotJid(sock))
);

return {
isOwner,
senderIsAdmin,
botIsAdmin,
isAuthorized: isOwner || senderIsAdmin
};
}

async function requireGroup(sock, jid, isGroup) {
if (isGroup) return true;

await sendReply(
sock,
jid,
‘❌ This command only works in groups.’
);

return false;
}

async function requireAuthorization(
sock,
jid,
command,
isAuthorized
) {
if (
!GROUP_COMMANDS.includes(command) ||
command === ‘admin’ ||
isAuthorized
) {
return true;
}

await sendReply(
sock,
jid,
‘⛔ Only group admins or the bot owner can use this command.’
);

return false;
}

async function requireBotAdmin(
sock,
jid,
command,
botIsAdmin
) {
if (
!BOT_ADMIN_COMMANDS.includes(command) ||
botIsAdmin
) {
return true;
}

await sendReply(
sock,
jid,
‘⚠️ Please make the bot a group administrator first.’
);

return false;
}

async function requireOwner(sock, jid, isOwner) {
if (isOwner) return true;

await sendReply(
sock,
jid,
‘⛔ Only the bot owner can use this command.’
);

return false;
}

async function requireTargets(sock, jid, command, targets) {
if (targets.length) return true;

const usage = command === ‘add’
? ‘Usage: .add 234XXXXXXXXXX’
: Usage: .${command} @user;

await sendReply(sock, jid, usage);

return false;
}

function formatAdminList(admins) {
return admins.map(
(participant, index) =>
${index + 1}. @${participant.id.split('@')[0]}
).join(’\n’);
}

export async function handleAdminCommand(
sock,
msg,
command,
args,
config
) {
const jid = msg.key.remoteJid;
const isGroup = isGroupJid(jid);
const sender = getSender(msg);

if (
GROUP_COMMANDS.includes(command) &&
!(await requireGroup(sock, jid, isGroup))
) {
return;
}

let metadata;

if (isGroup) {
metadata = await sock.groupMetadata(jid);
}

const {
isOwner,
isAuthorized,
botIsAdmin
} = getPermissionState(
sock,
metadata,
sender,
config
);

if (
!(await requireAuthorization(
sock,
jid,
command,
isAuthorized
))
) {
return;
}

if (
!(await requireBotAdmin(
sock,
jid,
command,
botIsAdmin
))
) {
return;
}

try {
switch (command) {
case ‘admin’: {
const admins = metadata.participants.filter(
participant => participant.admin
);

    return sendReply(
      sock,
      jid,
      `👑 GROUP ADMINISTRATORS\n\n${formatAdminList(admins)}`,
      { mentions: admins.map(participant => participant.id) }
    );
  }
  case 'kick':
  case 'promote':
  case 'demote': {
    const targets = resolveTargets(msg, args);
    if (
      !(await requireTargets(
        sock,
        jid,
        command,
        targets
      ))
    ) {
      return;
    }
    await sock.groupParticipantsUpdate(
      jid,
      targets,
      command === 'kick' ? 'remove' : command
    );
    return sendReply(
      sock,
      jid,
      `✅ ${command.toUpperCase()} command completed.`
    );
  }
  case 'add': {
    const targets = resolveTargets(msg, args);
    if (
      !(await requireTargets(
        sock,
        jid,
        command,
        targets
      ))
    ) {
      return;
    }
    const result = await sock.groupParticipantsUpdate(
      jid,
      targets,
      'add'
    );
    return sendReply(
      sock,
      jid,
      `✅ Add request processed.\n${JSON.stringify(result)}`
    );
  }
  case 'tagall':
  case 'hidetag': {
    const members = metadata.participants.map(
      participant => participant.id
    );
    const text = command === 'tagall'
      ? `📢 GROUP ANNOUNCEMENT\n\n${
          args.join(' ') || 'Attention everyone!'
        }`
      : args.join(' ') || '📢 Attention everyone!';
    return sendReply(
      sock,
      jid,
      text,
      { mentions: members }
    );
  }
  case 'mute':
  case 'unmute': {
    await sock.groupSettingUpdate(
      jid,
      command === 'mute'
        ? 'announcement'
        : 'not_announcement'
    );
    return sendReply(
      sock,
      jid,
      command === 'mute'
        ? '🔇 Group messaging restricted to admins.'
        : '🔊 Group messaging reopened.'
    );
  }
  case 'groupinfo': {
    return sendReply(
      sock,
      jid,
      `📊 GROUP INFORMATION\n\n` +
      `Name: ${metadata.subject}\n` +
      `Members: ${metadata.participants.length}\n` +
      `Created: ${metadata.creation || 'Unavailable'}\n` +
      `Description: ${metadata.desc || 'No description'}`
    );
  }
  case 'block':
  case 'unblock': {
    if (!(await requireOwner(sock, jid, isOwner))) {
      return;
    }
    const targets = resolveTargets(msg, args);
    if (
      !(await requireTargets(
        sock,
        jid,
        command,
        targets
      ))
    ) {
      return;
    }
    for (const target of targets) {
      await sock.updateBlockStatus(
        target,
        command === 'block' ? 'block' : 'unblock'
      );
    }
    return sendReply(
      sock,
      jid,
      `✅ Contact ${
        command === 'block'
          ? 'blocked'
          : 'unblocked'
      }.`
    );
  }
  default:
    return false;
}

} catch (error) {
console.error(‘Admin command error:’, error);

return sendReply(
  sock,
  jid,
  '❌ Command failed. Check permissions and try again.'
);

}
}    return sendReply(
      sock,
      jid,
      `👑 GROUP ADMINISTRATORS\n\n${formatAdminList(admins)}`,
      { mentions: admins.map(participant => participant.id) }
    );
  }

  case 'kick':
  case 'promote':
  case 'demote': {
    const targets = resolveTargets(msg, args);

    if (
      !(await requireTargets(
        sock,
        jid,
        command,
        targets
      ))
    ) {
      return;
    }

    await sock.groupParticipantsUpdate(
      jid,
      targets,
      command === 'kick' ? 'remove' : command
    );

    return sendReply(
      sock,
      jid,
      `✅ ${command.toUpperCase()} command completed.`
    );
  }

  case 'add': {
    const targets = resolveTargets(msg, args);

    if (
      !(await requireTargets(
        sock,
        jid,
        command,
        targets
      ))
    ) {
      return;
    }

    const result = await sock.groupParticipantsUpdate(
      jid,
      targets,
      'add'
    );

    return sendReply(
      sock,
      jid,
      `✅ Add request processed.\n${JSON.stringify(result)}`
    );
  }

  case 'tagall':
  case 'hidetag': {
    const members = metadata.participants.map(
      participant => participant.id
    );

    const text = command === 'tagall'
      ? `📢 GROUP ANNOUNCEMENT\n\n${
          args.join(' ') || 'Attention everyone!'
        }`
      : args.join(' ') || '📢 Attention everyone!';

    return sendReply(
      sock,
      jid,
      text,
      { mentions: members }
    );
  }

  case 'mute':
  case 'unmute': {
    await sock.groupSettingUpdate(
      jid,
      command === 'mute'
        ? 'announcement'
        : 'not_announcement'
    );

    return sendReply(
      sock,
      jid,
      command === 'mute'
        ? '🔇 Group messaging restricted to admins.'
        : '🔊 Group messaging reopened.'
    );
  }

  case 'groupinfo': {
    return sendReply(
      sock,
      jid,
      `📊 GROUP INFORMATION\n\n` +
      `Name: ${metadata.subject}\n` +
      `Members: ${metadata.participants.length}\n` +
      `Created: ${metadata.creation || 'Unavailable'}\n` +
      `Description: ${metadata.desc || 'No description'}`
    );
  }

  case 'block':
  case 'unblock': {
    if (!(await requireOwner(sock, jid, isOwner))) {
      return;
    }

    const targets = resolveTargets(msg, args);

    if (
      !(await requireTargets(
        sock,
        jid,
        command,
        targets
      ))
    ) {
      return;
    }

    for (const target of targets) {
      await sock.updateBlockStatus(
        target,
        command === 'block' ? 'block' : 'unblock'
      );
    }

    return sendReply(
      sock,
      jid,
      `✅ Contact ${
        command === 'block'
          ? 'blocked'
          : 'unblocked'
      }.`
    );
  }

  default:
    return false;
}return sendReply(
  sock,
  jid,
  '❌ Command failed. Check permissions and try again.'
);
