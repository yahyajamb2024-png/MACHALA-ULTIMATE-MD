  case 'admin': {
    const admins = metadata.participants.filter(
      p => p.admin
    );

    const mentions = admins.map(p => p.id);

    const list = admins.map(
      (p, i) => `${i + 1}. @${p.id.split('@')[0]}`
    ).join('\n');

    return sock.sendMessage(jid, {
      text: `👑 GROUP ADMINS\n\n${list}`,
      mentions
    });
  }

  case 'kick':
  case 'promote':
  case 'demote':
  case 'add': {
    const targets = getTargets(msg, args);

    if (!targets.length) {
      return sock.sendMessage(jid, {
        text: `Usage: .${command} @user`
      });
    }

    const action = command === 'kick'
      ? 'remove'
      : command;

    const result = await sock.groupParticipantsUpdate(
      jid, targets, action
    );

    return sock.sendMessage(jid, {
      text: `✅ ${command.toUpperCase()} request processed.\n${JSON.stringify(result)}`
    });
  }

  case 'tagall':
  case 'hidetag': {
    const members = metadata.participants.map(
      p => p.id
    );

    return sock.sendMessage(jid, {
      text: args.join(' ') || '📢 Attention everyone!',
      mentions: members
    });
  }

  case 'mute':
  case 'unmute': {
    await sock.groupSettingUpdate(
      jid,
      command === 'mute'
        ? 'announcement'
        : 'not_announcement'
    );

    return sock.sendMessage(jid, {
      text: command === 'mute'
        ? '🔇 Group muted.'
        : '🔊 Group unmuted.'
    });
  }

  case 'groupinfo': {
    return sock.sendMessage(jid, {
      text:
        `📊 GROUP INFORMATION\n\n` +
        `Name: ${metadata.subject}\n` +
        `Members: ${metadata.participants.length}\n` +
        `Description: ${metadata.desc || 'None'}`
    });
  }

  case 'block':
  case 'unblock': {
    const targets = getTargets(msg, args);

    if (!targets.length) {
      return sock.sendMessage(jid, {
        text: `Usage: .${command} 234XXXXXXXXXX`
      });
    }

    for (const target of targets) {
      await sock.updateBlockStatus(
        target,
        command === 'block' ? 'block' : 'unblock'
      );
    }

    return sock.sendMessage(jid, {
      text: `✅ Contact ${command === 'block' ? 'blocked' : 'unblocked'}.`
    });
  }

  default:
    return false;
}
return sock.sendMessage(jid, {
  text: '❌ Command failed. Check permissions and try again.'
});
