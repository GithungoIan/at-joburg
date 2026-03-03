const { VOICE } = require('../utils/atClient');
const logger = require('../utils/logger');
const { normalizePhoneNumber } = require('../utils/validator');


class VoiceService {
 
  async makeCall(to, from, callbackUrl = null) {
    try {
      const normalizedTo = normalizePhoneNumber(to);
      const normalizedFrom = normalizePhoneNumber(from);

      const options = {
        to: normalizedTo,
        from: normalizedFrom,
        ...(callbackUrl && { callbackUrl })
      };

      logger.info('Making outbound call', { to: normalizedTo, from: normalizedFrom });

      const result = await VOICE.call(options);

      logger.info('Call initiated', { result });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error('Error making call', { error: error.message });
      throw error;
    }
  }

  generateIvrResponse(params = {}) {
    const {
      greeting = 'Welcome to our service',
      menu = {},
      maxDigits = 1,
      timeout = 10,
      finishOnKey = '#'
    } = params;

    const response = {
      actions: [
        {
          say: { text: greeting },
          getDigits: {
            numDigits: maxDigits,
            timeout: timeout,
            finishOnKey: finishOnKey,
            callbackUrl: `${process.env.APP_URL}/voice/menu`
          }
        }
      ]
    };

    return response;
  }

  
  generateTtsResponse(text, options = {}) {
    const {
      voice = 'woman',
      playBeep = false
    } = options;

    const response = {
      actions: [
        {
          say: {
            text,
            voice,
            playBeep
          }
        }
      ]
    };

    return response;
  }

 
  generateCallbackResponse(phoneNumber) {
    const response = {
      actions: [
        {
          say: { text: 'Thank you. We will call you back shortly.' }
        },
        {
          dial: {
            phoneNumbers: [normalizePhoneNumber(phoneNumber)],
            record: false
          }
        }
      ]
    };

    return response;
  }


  generateRecordingPrompt(prompt, maxDuration = 30) {
    const response = {
      actions: [
        {
          say: { text: prompt },
          record: {
            maxDuration: maxDuration,
            trimSilence: true,
            playBeep: true,
            finishOnKey: '#',
            callbackUrl: `${process.env.APP_URL}/voice/recording-complete`
          }
        }
      ]
    };

    return response;
  }

  handleDtmfInput(dtmfDigits, menuOptions) {
    const option = menuOptions[dtmfDigits];

    if (!option) {
      return this.generateTtsResponse(
        'Invalid option. Please try again.'
      );
    }

    return option.response;
  }

  
  generateSupportIvr() {
    return {
      actions: [
        {
          say: {
            text: 'Thank you for calling customer support. Press 1 for technical support, 2 for billing, 3 for general inquiries, or 0 to speak with an agent.'
          },
          getDigits: {
            numDigits: 1,
            timeout: 10,
            finishOnKey: '#',
            callbackUrl: `${process.env.APP_URL}/voice/support-menu`
          }
        }
      ]
    };
  }

  generateOtpCall(otp) {
    const otpDigits = otp.split('').join(', ');

    return {
      actions: [
        {
          say: {
            text: `Your verification code is: ${otpDigits}. I repeat: ${otpDigits}. Thank you.`
          }
        }
      ]
    };
  }

  
  processCallStatus(callData) {
    const {
      sessionId,
      isActive,
      direction,
      callerNumber,
      destinationNumber,
      dtmfDigits,
      recordingUrl,
      durationInSeconds,
      currencyCode,
      amount
    } = callData;

    logger.info('Call status update', {
      sessionId,
      isActive,
      direction,
      duration: durationInSeconds
    });

    return {
      success: true,
      processed: true
    };
  }

  enqueueCall(queueName = 'support', holdMusic = null) {
    const response = {
      actions: [
        {
          say: { text: 'Please hold while we connect you to an agent.' },
          enqueue: {
            name: queueName,
            ...(holdMusic && { holdMusic })
          }
        }
      ]
    };

    return response;
  }

  setupConference(roomName) {
    const response = {
      actions: [
        {
          say: { text: 'Joining conference call.' },
          conference: {
            name: roomName,
            record: false,
            muted: false
          }
        }
      ]
    };

    return response;
  }
}

module.exports = new VoiceService();
