'use strict';

const express = require('express');
const router = express.Router();
const voiceService = require('./voiceService');
const { xmlRes } = require('./xmlBuilder');
const logger = require('../utils/logger');

const BASE_URL = () => process.env.APP_URL || 'https://your-app.example.com';

// In-memory OTP store: normalised phone number → otp string (single-use)
const otpStore = new Map();

/* ─────────────────────────────────────────────────────────────────── */
/*  POST /voice  – Main inbound callback                               */
/*                                                                      */
/*  Africa's Talking POSTs here on every inbound call event.          */
/*  isActive=1  → call is live, respond with XML actions.             */
/*  isActive=0  → call ended, log the event and return 200.           */
/* ─────────────────────────────────────────────────────────────────── */
router.post('/', (req, res) => {
  try {
    const { sessionId, isActive, direction, callerNumber } = req.body;

    logger.info('Voice callback received', { sessionId, direction, isActive, callerNumber });

    if (direction === 'Inbound' && isActive === '1') {
      return xmlRes(res, [
        {
          say: {
            text:
              'Welcome to the Africa\'s Talking Voice Capability Demo! ' +
              'Press 1 for text-to-speech. ' +
              'Press 2 to record a voice message. ' +
              'Press 3 to join a conference call. ' +
              'Press 4 for a call transfer demo. ' +
              'Press 5 for an O T P verification demo. ' +
              'Press 6 for business hours routing. ' +
              'Press 7 to request a call back. ' +
              'Press 9 for our Gemini A I assistant. ' +
              'Press 0 to leave a voicemail. ' +
              'Press star to see a redirect demo.'
          },
          getDigits: {
            numDigits:   1,
            timeout:     10,
            finishOnKey: '#',
            callbackUrl: `${BASE_URL()}/voice/demo-menu`
          }
        }
      ]);
    }

    if (isActive === '0') {
      voiceService.processCallStatus(req.body);
      return res.status(200).end();
    }

    // Fallback for any other state
    xmlRes(res, [{ say: { text: 'Thank you for calling. Goodbye.' } }]);
  } catch (error) {
    logger.error('Error in voice callback', { error: error.message });
    xmlRes(res, [{ say: { text: 'An error occurred. Please try again later.' } }]);
  }
});

/* ─────────────────────────────────────────────────────────────────── */
/*  POST /voice/demo-menu  – DTMF handler for the capability showcase  */
/*                                                                      */
/*  AT POSTs here after the caller presses a digit.                   */
/*  callerNumber is included so we can dial-back or store OTPs.       */
/* ─────────────────────────────────────────────────────────────────── */
router.post('/demo-menu', (req, res) => {
  try {
    const { dtmfDigits, callerNumber } = req.body;

    logger.info('Demo menu selection', { dtmfDigits, callerNumber });

    switch (dtmfDigits) {

      // ── 1: Text-to-speech ─────────────────────────────────────────
      // Demonstrates Say with both voice options and playBeep.
      case '1':
        return xmlRes(res, [
          { say: { text: 'This is the woman voice. Africa\'s Talking gives you natural text-to-speech across multiple languages.', voice: 'woman' } },
          { say: { text: 'And this is the man voice. You can switch between them dynamically for any prompt.', voice: 'man' } },
          { say: { text: 'Returning to the main menu.' } },
          { redirect: `${BASE_URL()}/voice` }
        ]);

      // ── 2: Record a voice message ──────────────────────────────────
      // Say is nested inside Record in AT Voice XML.
      case '2':
        return xmlRes(res, [
          {
            say: { text: 'Please record a short message after the beep. Press hash when done.' },
            record: {
              maxDuration: 20,
              trimSilence: true,
              playBeep:    true,
              finishOnKey: '#',
              callbackUrl: `${BASE_URL()}/voice/recording-complete`
            }
          }
        ]);

      // ── 3: Conference call ─────────────────────────────────────────
      // Multiple callers pressing 3 are joined into the same room.
      case '3':
        return xmlRes(res, [
          { say: { text: 'Joining the demo conference room. Any other caller who presses 3 will be connected with you.' } },
          {
            conference: {
              name:        'at-demo-room',
              record:      false,
              muted:       false,
              beepOnEnter: true,
              beepOnExit:  true
            }
          }
        ]);

      // ── 4: Call transfer / Dial demo ───────────────────────────────
      // Demonstrates the Dial action. Uses AGENT_PHONE_NUMBER when set,
      // falls back to the voice number itself to show the action fires.
      case '4': {
        const dialTarget = process.env.AGENT_PHONE_NUMBER || process.env.VOICE_PHONE_NUMBER;
        return xmlRes(res, [
          { say: { text: 'Demonstrating the Dial action. This bridges you to another number. Please hold.' } },
          {
            dial: {
              phoneNumbers: [dialTarget],
              record:       true,
              sequential:   true,
              maxDuration:  30
            }
          }
        ]);
      }

      // ── 5: OTP verification ────────────────────────────────────────
      // Generates an OTP, stores it keyed by callerNumber, then speaks
      // it in-call. The outbound-call variant is POST /voice/otp-verification.
      case '5': {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(callerNumber, otp);
        const spoken = otp.split('').join(', ');
        return xmlRes(res, [
          { say: { text: `Demonstrating O T P verification. Your demo code is: ${spoken}. I repeat: ${spoken}.` } },
          { say: { text: 'In production, this code arrives via an outbound call triggered by your application. Returning to the main menu.' } },
          { redirect: `${BASE_URL()}/voice` }
        ]);
      }

      // ── 6: Business hours routing ──────────────────────────────────
      // Redirects to a handler that checks time-of-day in SAST.
      case '6':
        return xmlRes(res, [
          { redirect: `${BASE_URL()}/voice/business-hours` }
        ]);

      // ── 7: Callback request ────────────────────────────────────────
      // Ends the call, then immediately triggers an outbound call back
      // to the same number to demonstrate the outbound call API.
      case '7': {
        const cbUrl = `${BASE_URL()}/voice/callback-connect`;
        setImmediate(() => {
          voiceService
            .makeCall(callerNumber, process.env.VOICE_PHONE_NUMBER, cbUrl)
            .catch(err => logger.error('Outbound callback failed', { error: err.message }));
        });
        return xmlRes(res, [
          { say: { text: 'Your callback is registered. We will call you right back on this number. Goodbye.' } }
        ]);
      }

      // ── 9: Gemini AI assistant ─────────────────────────────────────
      case '9':
        return xmlRes(res, [
          { say: { text: 'Connecting you to our Gemini A I assistant. Please hold.' } },
          { redirect: `${BASE_URL()}/voice/live` }
        ]);

      // ── 0: Voicemail ───────────────────────────────────────────────
      case '0':
        return xmlRes(res, [
          { redirect: `${BASE_URL()}/voice/leave-message` }
        ]);

      // ── *: Redirect demo ───────────────────────────────────────────
      case '*':
        return xmlRes(res, [
          { say: { text: 'Demonstrating the Redirect action. Africa\'s Talking will POST the full call session to any URL you specify.' } },
          { redirect: `${BASE_URL()}/voice/redirect-target` }
        ]);

      // ── Invalid input ──────────────────────────────────────────────
      default:
        return xmlRes(res, [
          {
            say: { text: 'Invalid option. Please try again.' },
            getDigits: {
              numDigits:   1,
              timeout:     10,
              finishOnKey: '#',
              callbackUrl: `${BASE_URL()}/voice/demo-menu`
            }
          }
        ]);
    }
  } catch (error) {
    logger.error('Error handling demo menu', { error: error.message });
    xmlRes(res, [{ say: { text: 'An error occurred. Please try again.' } }]);
  }
});

/* ─────────────────────────────────────────────────────────────────── */
/*  POST /voice/redirect-target  – Landing point for the Redirect demo */
/* ─────────────────────────────────────────────────────────────────── */
router.post('/redirect-target', (req, res) => {
  const { sessionId, callerNumber } = req.body;

  logger.info('Redirect target reached', { sessionId, callerNumber });

  xmlRes(res, [
    { say: { text: 'Redirect successful. Africa\'s Talking re-posted the full session here with all call metadata intact. Returning to the main menu.' } },
    { redirect: `${BASE_URL()}/voice` }
  ]);
});

/* ─────────────────────────────────────────────────────────────────── */
/*  POST /voice/business-hours  – Time-of-day routing demo (SAST)      */
/* ─────────────────────────────────────────────────────────────────── */
router.post('/business-hours', (req, res) => {
  const now       = new Date();
  const sastHour  = (now.getUTCHours() + 2) % 24;
  const isWeekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
  const isOpen    = isWeekday && sastHour >= 8 && sastHour < 17;

  logger.info('Business hours check', { sastHour, isWeekday, isOpen });

  if (!isOpen) {
    // Outside hours → voicemail
    return xmlRes(res, [
      {
        say: {
          text: 'Our office is currently closed. Business hours are Monday to Friday, 8 AM to 5 PM South Africa Standard Time. Please leave a message.'
        },
        record: {
          maxDuration: 60,
          trimSilence: true,
          playBeep:    true,
          finishOnKey: '#',
          callbackUrl: `${BASE_URL()}/voice/recording-complete`
        }
      }
    ]);
  }

  // Within hours → show a live menu
  xmlRes(res, [
    {
      say: { text: 'We are open! You can now see live business-hours routing. Press 1 for sales, 2 for support, or 0 to return to the main menu.' },
      getDigits: {
        numDigits:   1,
        timeout:     10,
        finishOnKey: '#',
        callbackUrl: `${BASE_URL()}/voice/demo-menu`
      }
    }
  ]);
});

/* ─────────────────────────────────────────────────────────────────── */
/*  POST /voice/make-call  – Initiate an outbound call (REST)          */
/*                                                                      */
/*  Called by your application, not by AT.                            */
/*  Optional: pass callbackUrl to control what XML plays on connect.  */
/* ─────────────────────────────────────────────────────────────────── */
router.post('/make-call', async (req, res) => {
  try {
    const { to, callbackUrl } = req.body;
    const from = process.env.VOICE_PHONE_NUMBER;

    if (!to || !from) {
      return res.status(400).json({
        status:  'error',
        message: 'Provide "to" in the request body. "from" is read from VOICE_PHONE_NUMBER env var.'
      });
    }

    const result = await voiceService.makeCall(to, from, callbackUrl || null);

    res.status(200).json({ status: 'success', message: 'Call initiated', data: result.data });
  } catch (error) {
    logger.error('Error making call', { error: error.message });
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/* ─────────────────────────────────────────────────────────────────── */
/*  POST /voice/otp-verification  – Trigger an outbound OTP call (REST)*/
/*                                                                      */
/*  Generates a 6-digit OTP, stores it, makes an outbound call.       */
/*  When the callee answers, AT hits /voice/otp-callback which reads  */
/*  the code aloud.                                                    */
/* ─────────────────────────────────────────────────────────────────── */
router.post('/otp-verification', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ status: 'error', message: 'phoneNumber is required' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(phoneNumber, otp);
    // In production: await redis.setex(`otp:voice:${phoneNumber}`, 600, otp);

    const callbackUrl = `${BASE_URL()}/voice/otp-callback`;
    const result = await voiceService.makeCall(phoneNumber, process.env.VOICE_PHONE_NUMBER, callbackUrl);

    res.status(200).json({
      status:  'success',
      message: 'OTP call initiated',
      otp,     // demo only – never expose in production
      data:    result.data
    });
  } catch (error) {
    logger.error('Error sending OTP call', { error: error.message });
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/* ─────────────────────────────────────────────────────────────────── */
/*  POST /voice/otp-callback  – AT hits this when the OTP call answers */
/*                                                                      */
/*  destinationNumber is the callee's number – used to look up the    */
/*  OTP from the in-memory store. Deleted after use (single-use).     */
/* ─────────────────────────────────────────────────────────────────── */
router.post('/otp-callback', (req, res) => {
  const { sessionId, destinationNumber } = req.body;

  const otp    = otpStore.get(destinationNumber) || '000000';
  otpStore.delete(destinationNumber); // single-use
  const spoken = otp.split('').join(', ');

  logger.info('OTP call connected', { sessionId, destinationNumber });

  xmlRes(res, [
    { say: { text: `Your verification code is: ${spoken}. I repeat: ${spoken}. Thank you.` } }
  ]);
});

/* ─────────────────────────────────────────────────────────────────── */
/*  POST /voice/callback-request  – Request an outbound callback (REST)*/
/*                                                                      */
/*  Triggers a real outbound call to the requester. When they answer, */
/*  AT posts to /voice/callback-connect which greets them.            */
/* ─────────────────────────────────────────────────────────────────── */
router.post('/callback-request', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ status: 'error', message: 'phoneNumber is required' });
    }

    logger.info('Callback requested', { phoneNumber });

    const callbackUrl = `${BASE_URL()}/voice/callback-connect`;
    const result = await voiceService.makeCall(phoneNumber, process.env.VOICE_PHONE_NUMBER, callbackUrl);

    res.status(200).json({
      status:  'success',
      message: 'Callback initiated. Calling you now.',
      data:    result.data
    });
  } catch (error) {
    logger.error('Error processing callback request', { error: error.message });
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/* ─────────────────────────────────────────────────────────────────── */
/*  POST /voice/callback-connect  – XML played when the callback answers*/
/*                                                                      */
/*  AT posts here when the person we called (the callback target)     */
/*  picks up. We greet them and drop them into the demo menu.         */
/* ─────────────────────────────────────────────────────────────────── */
router.post('/callback-connect', (req, res) => {
  const { sessionId, callerNumber } = req.body;

  logger.info('Outbound callback connected', { sessionId, callerNumber });

  xmlRes(res, [
    {
      say: { text: 'Hello! This is your requested callback from our support team. Thank you for your patience.' },
      getDigits: {
        numDigits:   1,
        timeout:     10,
        finishOnKey: '#',
        callbackUrl: `${BASE_URL()}/voice/demo-menu`
      }
    }
  ]);
});

/* ─────────────────────────────────────────────────────────────────── */
/*  POST /voice/recording-complete  – AT posts the recording URL here  */
/*                                                                      */
/*  Fires after any Record action completes. In production, persist   */
/*  the recordingUrl to your database here.                           */
/* ─────────────────────────────────────────────────────────────────── */
router.post('/recording-complete', (req, res) => {
  try {
    const { recordingUrl, durationInSeconds, sessionId } = req.body;

    logger.info('Recording completed', { sessionId, recordingUrl, duration: durationInSeconds });
    // In production: await db.recordings.create({ sessionId, url: recordingUrl, durationInSeconds });

    xmlRes(res, [
      { say: { text: `Thank you. Your ${durationInSeconds}-second message has been saved. We will get back to you soon. Goodbye.` } }
    ]);
  } catch (error) {
    logger.error('Error processing recording', { error: error.message });
    xmlRes(res, [{ say: { text: 'Recording saved. Thank you.' } }]);
  }
});

/* ─────────────────────────────────────────────────────────────────── */
/*  POST /voice/leave-message  – Voicemail entry point                 */
/*                                                                      */
/*  AT hits this URL; respond with XML to start recording.            */
/* ─────────────────────────────────────────────────────────────────── */
router.post('/leave-message', (req, res) => {
  try {
    xmlRes(res, [
      {
        say: { text: 'Please leave your message after the beep. Press hash when done.' },
        record: {
          maxDuration: 60,
          trimSilence: true,
          playBeep:    true,
          finishOnKey: '#',
          callbackUrl: `${BASE_URL()}/voice/recording-complete`
        }
      }
    ]);
  } catch (error) {
    logger.error('Error in leave message', { error: error.message });
    xmlRes(res, [{ say: { text: 'Unable to record message at this time.' } }]);
  }
});

/* ─────────────────────────────────────────────────────────────────── */
/*  GET /voice/test  – Health check & endpoint reference               */
/* ─────────────────────────────────────────────────────────────────── */
router.get('/test', (req, res) => {
  res.json({
    status:  'success',
    message: 'Voice endpoint is working',
    note:    'AT callback routes return text/xml. REST routes return JSON.',
    atCallbackRoutes: [
      'POST /voice                   – Main inbound IVR (returns XML)',
      'POST /voice/demo-menu         – DTMF handler: 1=TTS 2=Record 3=Conf 4=Dial 5=OTP 6=BizHours 7=Callback 9=AI 0=VM *=Redirect',
      'POST /voice/business-hours    – Time-of-day routing (returns XML)',
      'POST /voice/redirect-target   – Redirect demo landing (returns XML)',
      'POST /voice/otp-callback      – Speaks OTP when outbound call answers (returns XML)',
      'POST /voice/callback-connect  – Greets caller on outbound callback (returns XML)',
      'POST /voice/recording-complete – Recording webhook (returns XML)',
      'POST /voice/leave-message     – Voicemail recording start (returns XML)',
    ],
    restRoutes: [
      'POST /voice/make-call         – Initiate any outbound call (returns JSON)  body: { to, callbackUrl? }',
      'POST /voice/otp-verification  – Trigger OTP call (returns JSON)            body: { phoneNumber }',
      'POST /voice/callback-request  – Trigger outbound callback (returns JSON)   body: { phoneNumber }',
    ]
  });
});

module.exports = router;
