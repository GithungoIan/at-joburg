const logger = require('../utils/logger');

class UssdStateMachine {
  constructor() {
    this.states = new Map();
    this.sessionStore = new Map(); // In production, use Redis
    this.defaultState = 'home';
    this.sessionTimeout = 120000; // 2 minutes
  }


  addState(name, config) {
    this.states.set(name, {
      name,
      ...config
    });
    return this;
  }


  setDefaultState(stateName) {
    this.defaultState = stateName;
    return this;
  }

  async processRequest(request) {
    const { sessionId, serviceCode, phoneNumber, text } = request;

    try {
      // Get or create session
      let session = this.getSession(sessionId);
      if (!session) {
        session = this.createSession(sessionId, phoneNumber);
      }

      const inputs = text ? text.split('*') : [];
      const latestInput = inputs.length > 0 ? inputs[inputs.length - 1] : '';
      logger.info('Processing USSD', {
        sessionId,
        currentState: session.currentState,
        inputs,
        latestInput,
        inputCount: session.inputCount
      });

      if (inputs.length === 0) {
        session.currentState = this.defaultState;
        session.inputCount = 0;
        const state = this.states.get(this.defaultState);
        const result = await this.executeState(state, session, '', phoneNumber);
        this.updateSession(sessionId, session);
        return result;
      }


      const currentState = this.states.get(session.currentState);
      if (!currentState) {
        throw new Error(`State '${session.currentState}' not found`);
      }

      if (inputs.length > session.inputCount) {
        session.inputCount = inputs.length;

        const result = await this.executeState(currentState, session, latestInput, phoneNumber);
        this.updateSession(sessionId, session);
        return result;
      }

      const result = await this.executeState(currentState, session, '', phoneNumber);
      this.updateSession(sessionId, session);
      return result;

    } catch (error) {
      logger.error('Error processing USSD request', {
        error: error.message,
        stack: error.stack,
        sessionId
      });
      return 'END An error occurred. Please try again.';
    }
  }

  async executeState(state, session, input, phoneNumber) {
    logger.info('Executing state', {
      stateName: state.name,
      input,
      hasHandler: !!state.handler,
      hasOptions: !!state.options,
      hasDynamicContent: !!state.dynamicContent
    });

    if (state.options && input) {
      const option = state.options[input];
      if (option && option.nextState) {
        session.currentState = option.nextState;
        const nextState = this.states.get(option.nextState);
        if (nextState) {
          return await this.executeState(nextState, session, '', phoneNumber);
        }
      }
    }

    if (state.validate && input) {
      const validationResult = state.validate(input, session);
      if (!validationResult.valid) {
        const prompt = state.prompt || state.message || '';
        return `CON ${validationResult.message}\n\n${prompt}`;
      }
      if (state.storeAs) {
        session.data[state.storeAs] = validationResult.value !== undefined ? validationResult.value : input;
        logger.info('Stored data', { key: state.storeAs, value: session.data[state.storeAs] });
      }
    } else if (state.storeAs && input) {
      session.data[state.storeAs] = input;
    }

    if (state.handler && input) {
      const handlerResult = await state.handler(session, input, phoneNumber);
      if (handlerResult) {
        return handlerResult;
      }
    }

    if (state.dynamicContent) {
      const dynamicResult = await state.dynamicContent(session, phoneNumber);
      if (dynamicResult.startsWith('CON') || dynamicResult.startsWith('END')) {
        return dynamicResult;
      }
      return state.terminal ? `END ${dynamicResult}` : `CON ${dynamicResult}`;
    }

    let message = state.message || state.prompt || '';

    if (state.options) {
      const optionsText = this.buildOptionsMenu(state.options);
      if (message) {
        message += '\n\n' + optionsText;
      } else {
        message = optionsText;
      }
    }

    const prefix = state.terminal ? 'END' : 'CON';
    return `${prefix} ${message}`;
  }

  buildOptionsMenu(options) {
    return Object.entries(options)
      .map(([key, option]) => `${key}. ${option.label}`)
      .join('\n');
  }


  createSession(sessionId, phoneNumber) {
    const session = {
      id: sessionId,
      phoneNumber,
      currentState: this.defaultState,
      inputCount: 0,
      data: {},
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    this.sessionStore.set(sessionId, session);

    setTimeout(() => {
      this.sessionStore.delete(sessionId);
    }, this.sessionTimeout);

    return session;
  }

  getSession(sessionId) {
    return this.sessionStore.get(sessionId);
  }

  updateSession(sessionId, session) {
    session.lastActivity = Date.now();
    this.sessionStore.set(sessionId, session);
  }

  clearSession(sessionId) {
    this.sessionStore.delete(sessionId);
  }
}

class UssdMenuBuilder {
  constructor(stateMachine) {
    this.stateMachine = stateMachine;
  }

  menu(name, message) {
    const options = {};

    const builder = {
      option: (key, label, nextState) => {
        options[key] = { label, nextState };
        return builder;
      },
      done: () => {
        this.stateMachine.addState(name, {
          message,
          options
        });
        return this;
      }
    };

    return builder;
  }


  input(name, prompt, config = {}) {
    this.stateMachine.addState(name, {
      prompt,
      message: prompt,
      validate: config.validate,
      storeAs: config.storeAs,
      handler: config.handler,
      nextState: config.nextState
    });
    return this;
  }

  end(name, message) {
    this.stateMachine.addState(name, {
      message,
      terminal: true
    });
    return this;
  }

  dynamic(name, contentGenerator, config = {}) {
    this.stateMachine.addState(name, {
      dynamicContent: contentGenerator,
      terminal: config.terminal || false,
      options: config.options
    });
    return this;
  }

  build() {
    return this.stateMachine;
  }
}


const Validators = {
  phoneNumber: (input) => {
    const pattern = /^(\+?27[678]\d{8}|0[678]\d{8}|\+?234[789]\d{9}|\+?254[17]\d{8}|\+\d{10,15})$/;
    const valid = pattern.test(input);
    return {
      valid,
      message: valid ? '' : 'Invalid phone number. Try again (e.g., +27712345678 or 0712345678):',
      value: valid ? input : null
    };
  },

  amount: (input) => {
    const amount = parseFloat(input);
    const valid = !isNaN(amount) && amount > 0;
    return {
      valid,
      message: valid ? '' : 'Invalid amount. Enter a valid number:',
      value: valid ? amount : null
    };
  },

  pin: (length = 4) => (input) => {
    const valid = /^\d+$/.test(input) && input.length === length;
    return {
      valid,
      message: valid ? '' : `Invalid PIN. Enter ${length} digits:`,
      value: valid ? input : null
    };
  },

  choice: (validChoices) => (input) => {
    const valid = validChoices.includes(input);
    return {
      valid,
      message: valid ? '' : `Invalid choice. Select from ${validChoices.join(', ')}:`,
      value: valid ? input : null
    };
  },

  notEmpty: (input) => {
    const valid = input && input.trim().length > 0;
    return {
      valid,
      message: valid ? '' : 'This field is required. Try again:',
      value: valid ? input.trim() : null
    };
  }
};

module.exports = {
  UssdStateMachine,
  UssdMenuBuilder,
  Validators
};
