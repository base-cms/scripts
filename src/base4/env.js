const envalid = require('@base-cms/env');

const { cleanEnv, validators } = envalid;
const { nonemptystr } = validators;

module.exports = cleanEnv(process.env, {
  TENANT_KEY: nonemptystr({ desc: 'The Base tenant key.' }),
  MONGO_DSN: nonemptystr({ desc: 'The Base MongoDB connection URL.' }),
  BASE4_API_URL: nonemptystr(),
  BASE4_USERNAME: nonemptystr(),
  BASE4_PASSWORD: nonemptystr(),
});
