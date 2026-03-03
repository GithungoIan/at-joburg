const Joi = require("joi");

const phoneNumberSchema = Joi.string()
  .pattern(
    /^(\+?27[678]\d{8}|0[678]\d{8}|\+?234[789]\d{9}|\+?254[17]\d{8}|0[17]\d{8}|\+\d{10,15})$/,
  )
  .required()
  .messages({
    "string.pattern.base":
      "Phone number must be valid (e.g., +27712345678, 0712345678 for South Africa; +254700000000, 0700000000 for Kenya)",
  });

const normalizePhoneNumber = (phoneNumber, defaultCountryCode = "27") => {
  let normalized = phoneNumber.replace(/[\s\-()]/g, "");
  if (normalized.startsWith("0")) {
    normalized = "+" + defaultCountryCode + normalized.substring(1);
  }

  if (!normalized.startsWith("+") && /^\d{12,15}$/.test(normalized)) {
    normalized = "+" + normalized;
  }

  if (!normalized.startsWith("+")) {
    normalized = "+" + defaultCountryCode + normalized;
  }

  return normalized;
};

const validateSmsRequest = (data) => {
  const schema = Joi.object({
    to: Joi.alternatives()
      .try(phoneNumberSchema, Joi.array().items(phoneNumberSchema))
      .required(),
    message: Joi.string().min(1).max(160).required(),
    from: Joi.string().optional(),
  });

  return schema.validate(data);
};

const validateAirtimeRequest = (data) => {
  const schema = Joi.object({
    phoneNumber: phoneNumberSchema,
    amount: Joi.string()
      .pattern(/^[A-Z]{3}\s\d+(\.\d{1,2})?$/)
      .required()
      .messages({
        "string.pattern.base":
          'Amount must be in format "KES 100" or "USD 10.50"',
      }),
    currencyCode: Joi.string().length(3).optional(),
  });

  return schema.validate(data);
};

const validateDataRequest = (data) => {
  const schema = Joi.object({
    phoneNumber: phoneNumberSchema,
    productName: Joi.string().required(),
    quantity: Joi.number().integer().min(1).default(1),
  });

  return schema.validate(data);
};

const validateWebhookSignature = (signature, payload, secret) => {
  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");

  return signature === expectedSignature;
};

module.exports = {
  phoneNumberSchema,
  normalizePhoneNumber,
  validateSmsRequest,
  validateAirtimeRequest,
  validateDataRequest,
  validateWebhookSignature,
};
