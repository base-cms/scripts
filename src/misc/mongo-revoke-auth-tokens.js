// const { log } = console;
const db = {};

// Platform\Content fields
db.runCommand('listDatabases').databases.filter(({ name }) => name.includes('_platform')).map(({ name }) => name).forEach((name) => {
  const sdb = db.getSiblingDB(name);
  sdb.getCollection('AuthToken').drop();
  sdb.getCollection('AuthToken').createIndex({ 'payload.jti': 1 }, { unique: true, background: true });
  sdb.getCollection('AuthToken').createIndex({ expires: 1 }, { background: true, expireAfterSeconds: 0 });
});
