const africastalking = require("africastalking");
const logger = require("./logger");

const requiredEnvVars = ["AT_API_KEY", "AT_USERNAME"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);

if (missingEnvVars.length > 0) {
  logger.error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
}

const credentials = {
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
};

const atClient = africastalking(credentials);

const SMS = atClient.SMS;
const AIRTIME = atClient.AIRTIME;
const VOICE = atClient.VOICE;
const TOKEN = atClient.TOKEN;
const ACCOUNT = atClient.ACCOUNT;
logger.info("Africa's Talking client initialized successfully");

module.exports = {
  atClient,
  SMS,
  AIRTIME,
  VOICE,
  TOKEN,
  ACCOUNT,
};
