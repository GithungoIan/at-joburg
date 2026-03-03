const express = require('express');
const router = express.Router();
const { xmlRes } = require('./xmlBuilder');
const logger = require('../utils/logger');

const BASE_URL = () => process.env.APP_URL || 'https://your-app.example.com';


router.get('/', (req, res) => {
  res.json({
    status: 'success',
    description: 'Africa\'s Talking Voice – call action examples',
    actions: {
      say: 'POST /voice/examples/say',
      play: 'POST /voice/examples/play',
      getDigits: 'POST /voice/examples/get-digits',
      dial: 'POST /voice/examples/dial',
      record: 'POST /voice/examples/record',
      enqueue: 'POST /voice/examples/enqueue',
      dequeue: 'POST /voice/examples/dequeue',
      conference: 'POST /voice/examples/conference',
      redirect: 'POST /voice/examples/redirect',
      reject: 'POST /voice/examples/reject',
      chained: 'POST /voice/examples/chained',
      conditionalMenu: 'POST /voice/examples/conditional-menu',
    }
  });
});

/* ------------------------------------------------------------------ */
/*  SAY – Text-to-speech                                               */
/*                                                                     */
/*  Params:                                                            */
/*    text      (string)  – what to speak                             */
/*    voice     (string)  – "man" | "woman"  (default: "woman")       */
/*    playBeep  (boolean) – play a beep before speaking               */
/* ------------------------------------------------------------------ */
router.post('/say', (req, res) => {
  const { text = 'Hello! Welcome to Africa\'s Talking voice service. Siyakwamukela!', voice = 'woman', playBeep = false } = req.body;

  logger.info('Example: say action', { text, voice });

  xmlRes(res, [
    {
      say: {
        text,
        voice,        // "man" | "woman"
        playBeep      // true  → plays a beep tone first
      }
    }
  ]);
});

/* ------------------------------------------------------------------ */
/*  PLAY – Stream a remote audio file (MP3 / WAV)                      */
/*                                                                     */
/*  Params:                                                            */
/*    url (string) – publicly accessible audio file URL               */
/* ------------------------------------------------------------------ */
router.post('/play', (req, res) => {
  const { url = 'https://example.com/audio/welcome.mp3' } = req.body;

  logger.info('Example: play action', { url });

  xmlRes(res, [
    {
      play: {
        url  // Must be publicly accessible and return audio/mpeg or audio/wav
      }
    }
  ]);
});

/* ------------------------------------------------------------------ */
/*  GET DIGITS – Collect DTMF keypad input                             */
/*                                                                     */
/*  AT will POST the collected digits to callbackUrl as `dtmfDigits`. */
/*                                                                     */
/*  Params:                                                            */
/*    numDigits    (number)  – how many digits to collect              */
/*    timeout      (number)  – seconds to wait for first digit        */
/*    finishOnKey  (string)  – key that ends collection ("#" default) */
/* ------------------------------------------------------------------ */
router.post('/get-digits', (req, res) => {
  const { numDigits = 1, timeout = 10, finishOnKey = '#' } = req.body;

  logger.info('Example: getDigits action');

  // Say is nested INSIDE GetDigits in AT Voice XML
  xmlRes(res, [
    {
      say: {
        text: 'Press 1 for English, 2 for Zulu, 3 for Xhosa, or 4 for Afrikaans. Press hash to confirm.'
      },
      getDigits: {
        numDigits,            // collect exactly N digits
        timeout,              // idle timeout in seconds
        finishOnKey,          // stop collecting when this key is pressed
        callbackUrl: `${BASE_URL()}/voice/examples/get-digits/callback`
      }
    }
  ]);
});

// Callback that receives the digit selection
router.post('/get-digits/callback', (req, res) => {
  const { dtmfDigits, sessionId } = req.body;

  logger.info('Digits received', { dtmfDigits, sessionId });

  const languages = {
    '1': 'English',
    '2': 'Zulu',
    '3': 'Xhosa',
    '4': 'Afrikaans'
  };

  const selected = languages[dtmfDigits];

  if (!selected) {
    return xmlRes(res, [{ say: { text: 'Invalid option. Please call again.' } }]);
  }

  xmlRes(res, [
    {
      say: { text: `You selected ${selected}. Thank you for calling!` }
    }
  ]);
});

/* ------------------------------------------------------------------ */
/*  DIAL – Bridge / connect the caller to another phone number         */
/*                                                                     */
/*  Params:                                                            */
/*    phoneNumbers (array)   – numbers to try (E.164 format)          */
/*    record       (boolean) – record the bridged call                */
/*    sequential   (boolean) – try numbers one at a time              */
/*    ringbackTone (string)  – audio URL played while ringing         */
/*    maxDuration  (number)  – max call length in seconds             */
/* ------------------------------------------------------------------ */
router.post('/dial', (req, res) => {
  const {
    phoneNumbers = ['+27712345678'],
    record = false,
    sequential = true,
    ringbackTone = null,
    maxDuration = 3600
  } = req.body;

  logger.info('Example: dial action', { phoneNumbers });

  const dialOptions = {
    phoneNumbers,    // array of E.164 numbers
    record,          // true → AT records the call and posts URL to your callback
    sequential,      // true → try each number in order; false → ring all at once
    maxDuration      // hang up after this many seconds
  };

  if (ringbackTone) {
    dialOptions.ringbackTone = ringbackTone; // audio URL played to the originator
  }

  xmlRes(res, [
    {
      say: { text: 'Please hold while we connect your call.' }
    },
    {
      dial: dialOptions
    }
  ]);
});

/* ------------------------------------------------------------------ */
/*  RECORD – Record the caller's voice                                 */
/*                                                                     */
/*  AT will POST the recording URL to callbackUrl when done.          */
/*                                                                     */
/*  Params:                                                            */
/*    maxDuration  (number)  – maximum recording length in seconds    */
/*    trimSilence  (boolean) – strip leading/trailing silence         */
/*    playBeep     (boolean) – play a beep before recording starts    */
/*    finishOnKey  (string)  – key that stops the recording           */
/* ------------------------------------------------------------------ */
router.post('/record', (req, res) => {
  const {
    maxDuration = 30,
    trimSilence = true,
    playBeep = true,
    finishOnKey = '#'
  } = req.body;

  logger.info('Example: record action');

  // Say is nested INSIDE Record in AT Voice XML
  xmlRes(res, [
    {
      say: {
        text: 'Please leave a message after the beep. Press hash when you are done.'
      },
      record: {
        maxDuration,      // seconds (max 3600)
        trimSilence,      // remove silence from start / end
        playBeep,         // audible cue before recording
        finishOnKey,      // caller presses this to stop early
        callbackUrl: `${BASE_URL()}/voice/examples/record/callback`
      }
    }
  ]);
});

// Callback invoked when the recording is ready
router.post('/record/callback', (req, res) => {
  const { recordingUrl, durationInSeconds, sessionId } = req.body;

  logger.info('Recording ready', { sessionId, recordingUrl, durationInSeconds });

  // In production: persist recordingUrl to your database
  // await db.recordings.create({ sessionId, url: recordingUrl, duration: durationInSeconds });

  xmlRes(res, [
    {
      say: {
        text: `Your message of ${durationInSeconds} seconds has been saved. We will get back to you soon. Goodbye.`
      }
    }
  ]);
});

/* ------------------------------------------------------------------ */
/*  ENQUEUE – Place caller in a named wait queue                       */
/*                                                                     */
/*  Use this to hold callers until an agent is ready (call-centre).   */
/*  Pair with the DEQUEUE action on the agent side.                   */
/*                                                                     */
/*  Params:                                                            */
/*    name       (string) – queue identifier                          */
/*    holdMusic  (string) – audio URL streamed while caller waits     */
/* ------------------------------------------------------------------ */
router.post('/enqueue', (req, res) => {
  const {
    name = 'support',
    holdMusic = null
  } = req.body;

  logger.info('Example: enqueue action', { name });

  const enqueueOptions = { name };
  if (holdMusic) enqueueOptions.holdMusic = holdMusic;

  xmlRes(res, [
    {
      say: {
        text: 'All our agents are currently busy. Please hold and the next available agent will assist you.'
      }
    },
    {
      enqueue: enqueueOptions
    }
  ]);
});

/* ------------------------------------------------------------------ */
/*  DEQUEUE – Pull a caller from a queue to an agent's phone          */
/*                                                                     */
/*  This action is used on the AGENT's callback URL, not the          */
/*  original caller's callback.                                       */
/*                                                                     */
/*  Params:                                                            */
/*    name        (string) – queue to dequeue from                    */
/*    phoneNumber (string) – agent's phone number                     */
/* ------------------------------------------------------------------ */
router.post('/dequeue', (req, res) => {
  const {
    name = 'support',
    phoneNumber = process.env.AGENT_PHONE_NUMBER || '+27800000099'
  } = req.body;

  logger.info('Example: dequeue action', { name, phoneNumber });

  xmlRes(res, [
    {
      dequeue: {
        name,         // must match the queue name used in enqueue
        phoneNumber   // agent's number to ring
      }
    }
  ]);
});

/* ------------------------------------------------------------------ */
/*  CONFERENCE – Drop the caller into a named conference room          */
/*                                                                     */
/*  Multiple callers using the same room name are connected together. */
/*                                                                     */
/*  Params:                                                            */
/*    name         (string)  – conference room identifier             */
/*    record       (boolean) – record the conference                  */
/*    muted        (boolean) – join muted (listen-only)               */
/*    beepOnEnter  (boolean) – play beep when participant joins       */
/*    beepOnExit   (boolean) – play beep when participant leaves      */
/* ------------------------------------------------------------------ */
router.post('/conference', (req, res) => {
  const {
    name = 'team-standup',
    record = false,
    muted = false,
    beepOnEnter = true,
    beepOnExit = true
  } = req.body;

  logger.info('Example: conference action', { name });

  xmlRes(res, [
    {
      say: { text: `Joining conference room: ${name}. You are now connected.` }
    },
    {
      conference: {
        name,
        record,
        muted,
        beepOnEnter,
        beepOnExit
      }
    }
  ]);
});

/* ------------------------------------------------------------------ */
/*  REDIRECT – Hand off control to another webhook                     */
/*                                                                     */
/*  AT will make a new POST request to the target URL with the same  */
/*  session data. Useful for routing logic across microservices.      */
/*                                                                     */
/*  Params:                                                            */
/*    url (string) – target webhook that will return the next actions */
/* ------------------------------------------------------------------ */
router.post('/redirect', (req, res) => {
  const { url = `${BASE_URL()}/voice/examples/redirect/target` } = req.body;

  logger.info('Example: redirect action', { url });

  xmlRes(res, [
    {
      redirect: url   // AT posts session data here and follows the response
    }
  ]);
});

// Target endpoint that gets control after redirect
router.post('/redirect/target', (req, res) => {
  const { sessionId, callerNumber } = req.body;

  logger.info('Redirect target reached', { sessionId, callerNumber });

  xmlRes(res, [
    {
      say: { text: 'You have been redirected to the target service. How can we help you today?' }
    }
  ]);
});

/* ------------------------------------------------------------------ */
/*  REJECT – Reject the call without answering                         */
/*                                                                     */
/*  The caller hears a busy tone. Use to block numbers, enforce       */
/*  business hours, or manage capacity.                               */
/* ------------------------------------------------------------------ */
router.post('/reject', (req, res) => {
  const { callerNumber, sessionId } = req.body;

  logger.info('Example: reject action', { callerNumber, sessionId });

  xmlRes(res, [
    {
      reject: {}  // No parameters needed — caller hears busy signal
    }
  ]);
});

/* ------------------------------------------------------------------ */
/*  CHAINED – Multiple actions in a single response                    */
/*                                                                     */
/*  AT executes actions sequentially in the order they appear.        */
/*  This example: greet → play audio → collect digit → record         */
/* ------------------------------------------------------------------ */
router.post('/chained', (req, res) => {
  logger.info('Example: chained actions');

  xmlRes(res, [
    // 1. Greet the caller
    {
      say: { text: 'Welcome to the South Africa voice demo. This call will be recorded for quality assurance.' }
    },
    // 2. Play a short jingle
    {
      play: { url: 'https://example.com/audio/jingle.mp3' }
    },
    // 3. Collect a digit – Say is nested inside GetDigits in the XML
    {
      say: { text: 'Press 1 to speak with sales, or 2 to leave a voice message.' },
      getDigits: {
        numDigits: 1,
        timeout: 8,
        finishOnKey: '#',
        callbackUrl: `${BASE_URL()}/voice/examples/chained/route`
      }
    }
  ]);
});

// Route handler after the chained getDigits
router.post('/chained/route', (req, res) => {
  const { dtmfDigits } = req.body;

  logger.info('Chained route selection', { dtmfDigits });

  if (dtmfDigits === '1') {
    return xmlRes(res, [
      { say: { text: 'Connecting you to our sales team.' } },
      { dial: { phoneNumbers: ['+27800000010'], record: true, sequential: true } }
    ]);
  }

  // Default: leave a voice message – Say nested inside Record
  xmlRes(res, [
    {
      say: { text: 'Please leave your message after the beep. Press hash when done.' },
      record: {
        maxDuration: 60,
        trimSilence: true,
        playBeep: true,
        finishOnKey: '#',
        callbackUrl: `${BASE_URL()}/voice/examples/record/callback`
      }
    }
  ]);
});

/* ------------------------------------------------------------------ */
/*  CONDITIONAL MENU – Business-hours aware IVR                        */
/*                                                                     */
/*  Shows how to make dynamic decisions before returning actions.     */
/* ------------------------------------------------------------------ */
router.post('/conditional-menu', (req, res) => {
  const { callerNumber } = req.body;

  const now = new Date();
  // South Africa Standard Time (SAST) = UTC+2
  const sastHour = (now.getUTCHours() + 2) % 24;
  const isWeekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
  const isBusinessHours = sastHour >= 8 && sastHour < 17;

  logger.info('Conditional menu', { callerNumber, sastHour, isWeekday, isBusinessHours });

  if (!isWeekday || !isBusinessHours) {
    // Out of hours – offer voicemail – Say nested inside Record
    return xmlRes(res, [
      {
        say: {
          text: 'Our office is currently closed. Business hours are Monday to Friday, 8 AM to 5 PM South Africa Standard Time. Please leave a message and we will call you back.'
        },
        record: {
          maxDuration: 60,
          trimSilence: true,
          playBeep: true,
          finishOnKey: '#',
          callbackUrl: `${BASE_URL()}/voice/examples/record/callback`
        }
      }
    ]);
  }

  // Business hours – show full IVR – Say nested inside GetDigits
  xmlRes(res, [
    {
      say: {
        text: 'Thank you for calling. Press 1 for sales, 2 for support, 3 for billing, or 0 to hold for an agent.'
      },
      getDigits: {
        numDigits: 1,
        timeout: 10,
        finishOnKey: '#',
        callbackUrl: `${BASE_URL()}/voice/examples/conditional-menu/route`
      }
    }
  ]);
});

router.post('/conditional-menu/route', (req, res) => {
  const { dtmfDigits } = req.body;

  const routes = {
    '1': { text: 'Connecting to sales.', number: '+27800000011' },
    '2': { text: 'Connecting to support.', number: '+27800000012' },
    '3': { text: 'Connecting to billing.', number: '+27800000013' }
  };

  const route = routes[dtmfDigits];

  if (!route) {
    // '0' or anything else → enqueue
    return xmlRes(res, [
      { say: { text: 'Placing you in the queue. An agent will be with you shortly.' } },
      { enqueue: { name: 'general' } }
    ]);
  }

  xmlRes(res, [
    { say: { text: route.text } },
    { dial: { phoneNumbers: [route.number], record: true, sequential: true } }
  ]);
});

module.exports = router;
