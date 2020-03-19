#!/usr/bin/env node

const createDB = require('../../create-db');
const env = require('../../env');
const devAll = require('./dev-all');
const devSr = require('./dev-senior');
const ebm = require('./ebm');

const { log } = console;

const getKeys = async () => {
  const basedb = createDB(env.TENANT_KEY);
  const client = await basedb.client.connect();
  log(`BaseCMS DB connected to ${client.s.url} for ${basedb.tenant}`);

  const admin = await basedb.client.admin();
  const dbs = await admin.listDatabases();

  const filtered = dbs.databases.map((db) => db.name).filter((name) => name.includes('_platform'));
  return filtered.map((name) => name.replace('_platform', ''));
};

const run = async (TENANT_KEY) => {
  const basedb = createDB(TENANT_KEY);
  await basedb.client.connect();

  const bulkOps = [];
  const contentOps = [];
  const coll = await basedb.collection('platform', 'User');
  const contentColl = await basedb.collection('platform', 'Content');

  const mapper = async (user) => {
    const query = { username: user.username };
    const count = await coll.countDocuments(query);
    if (count > 1) {
      const users = await coll.find(query, { projection: { _id: 1 } }).toArray();
      const primary = users[0];
      const dupes = users.slice(1);
      dupes.forEach((dupe) => {
        bulkOps.push({ deleteOne: { filter: { _id: dupe._id } } });
        contentOps.push({
          updateMany: {
            filter: { updatedBy: dupe._id },
            update: { $set: { updatedBy: primary._id } },
          },
        });
        contentOps.push({
          updateMany: {
            filter: { createdBy: dupe._id },
            update: { $set: { createdBy: primary._id } },
          },
        });
      });
    }
    bulkOps.push({
      updateOne: { filter: query, update: { $set: user }, upsert: true },
    });
  };

  const devs = /^abm_/.test(TENANT_KEY) ? devSr : devAll;
  await Promise.all(devs.map(mapper));

  if (/^(ebm|cygnus)_/.test(TENANT_KEY) && TENANT_KEY !== 'cygnus_mprc') {
    await Promise.all(ebm.map(mapper));
  }

  // return log(`${TENANT_KEY} >> Skipping writes: ${bulkOps.length} ${contentOps.length} queued.`);

  log(`${TENANT_KEY} >> Performing ${bulkOps.length} user bulk operations`);
  await coll.bulkWrite(bulkOps, { ordered: false });
  if (contentOps.length) {
    log(`${TENANT_KEY} >> Performing ${contentOps.length} content bulk operations`);
    await contentColl.bulkWrite(contentOps, { ordered: false });
  }
};

const main = async () => {
  const keys = await getKeys();
  await Promise.all(keys.map(run));

  log('Done');
  process.exit();
};

process.on('unhandledRejection', (e) => { throw e; });
main().catch((e) => setImmediate(() => { throw e; }));
