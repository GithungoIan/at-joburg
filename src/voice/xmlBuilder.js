
'use strict';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function attrs(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ');
}


function sayEl(say) {
  if (!say) return '';
  const { text = '', voice = 'woman', playBeep = false } = say;
  return `<Say${playBeep ? ' playBeep="true"' : ''} voice="${voice}">${esc(text)}</Say>`;
}

function playEl(play) {
  if (!play?.url) return '';
  return `<Play url="${esc(play.url)}"/>`;
}


function promptEl(action) {
  if (action.say)  return sayEl(action.say);
  if (action.play) return playEl(action.play);
  return '';
}

function getDigitsEl(action) {
  const g = action.getDigits;
  return `<GetDigits ${attrs({
    numDigits:   g.numDigits,
    timeout:     g.timeout,
    finishOnKey: g.finishOnKey,
    callbackUrl: g.callbackUrl
  })}>${promptEl(action)}</GetDigits>`;
}

function recordEl(action) {
  const r = action.record;
  return `<Record ${attrs({
    maxDuration: r.maxDuration,
    trimSilence: r.trimSilence,
    playBeep:    r.playBeep,
    finishOnKey: r.finishOnKey,
    callbackUrl: r.callbackUrl
  })}>${promptEl(action)}</Record>`;
}

function dialEl(dial) {
  const numbers = Array.isArray(dial.phoneNumbers)
    ? dial.phoneNumbers.join(',')
    : (dial.phoneNumbers || '');

  return `<Dial ${attrs({
    phoneNumbers: numbers,
    record:       dial.record,
    sequential:   dial.sequential,
    maxDuration:  dial.maxDuration,
    ringbackTone: dial.ringbackTone
  })}/>`;
}

function enqueueEl(enqueue) {
  return `<Enqueue ${attrs({
    name:      enqueue.name,
    holdMusic: enqueue.holdMusic
  })}/>`;
}

function dequeueEl(dequeue) {
  return `<Dequeue ${attrs({
    name:        dequeue.name,
    phoneNumber: dequeue.phoneNumber
  })}/>`;
}

function conferenceEl(conference) {
  return `<Conference ${attrs({
    name:        conference.name,
    record:      conference.record,
    muted:       conference.muted,
    beepOnEnter: conference.beepOnEnter,
    beepOnExit:  conference.beepOnExit
  })}/>`;
}


function buildXml(actions = []) {
  const parts = [];

  for (const action of actions) {
    if (action.redirect) {
      parts.push(`<Redirect>${esc(action.redirect)}</Redirect>`);
      continue;
    }

    if (action.reject !== undefined) {
      parts.push('<Reject/>');
      continue;
    }

    if (action.getDigits) {
      parts.push(getDigitsEl(action));
      continue;
    }

    if (action.record) {
      parts.push(recordEl(action));
      continue;
    }

    if (action.say)  parts.push(sayEl(action.say));
    if (action.play) parts.push(playEl(action.play));

    if (action.dial)       parts.push(dialEl(action.dial));
    if (action.enqueue)    parts.push(enqueueEl(action.enqueue));
    if (action.dequeue)    parts.push(dequeueEl(action.dequeue));
    if (action.conference) parts.push(conferenceEl(action.conference));
  }

  return `<?xml version="1.0" encoding="UTF-8"?><Response>${parts.join('')}</Response>`;
}


function xmlRes(res, actions) {
  res.set('Content-Type', 'text/xml');
  res.send(buildXml(actions));
}

module.exports = { buildXml, xmlRes };
