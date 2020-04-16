#!/usr/bin/env node

/**
 * Merges groups together into a multi-site instance
 *
 * @todo convert website.Page to platform.ContentPage
 * @todo create top-level categories for imported data sets
 * @todo make sources/targets inputtable
 * @todo dedupe users, usernames should be unique!
 * @todo dedupe non-hierarchical taxonomy
 * @todo should ModelHistory be retained?
 * @todo Automate renaming of Options to Pinned/Standard
 */
const bcrypt = require('bcrypt');
const { createMongoClient } = require('@base-cms/db');
const { MONGO_DSN, TENANT_KEY } = require('../../env');

const client = createMongoClient(MONGO_DSN, { appname: '@base-cms/scripts', useUnifiedTopology: true });
const { log } = console;

const updateDeveloper = async (userColl, contentColl) => {
  log('Checking api.import and developer accounts');
  const user = await userColl.findOne({ username: 'api.import' });
  const usernames = [
    'developer',
    'cbrundige',
    'chusting',
    'jstarks',
    'jworden@southcomm.com',
    'jschaeffer@southcomm.com',
    'bkrigbaum@southcomm.com',
  ];
  const ids = await userColl.distinct('_id', { username: { $in: usernames } });
  if (!ids.length) return;
  await contentColl.bulkWrite([
    {
      updateMany: {
        filter: { createdBy: { $in: ids } },
        update: { $set: { createdBy: user._id } },
      },
    },
    {
      updateMany: {
        filter: { updatedBy: { $in: ids } },
        update: { $set: { updatedBy: user._id } },
      },
    },
  ]);
  await userColl.bulkWrite([
    {
      deleteMany: {
        filter: { _id: { $in: ids } },
      },
    },
  ]);
};

const getMasterUser = (users) => {
  const first = users[0];
  // eslint-disable-next-line no-prototype-builtins
  const native = users.filter((user) => !user.hasOwnProperty('legacy'));
  return native.length ? native[0] : first;
};

const dedupeUsers = async (userColl, contentColl) => {
  log('Aggregating and deduping users');
  const users = await userColl.aggregate([
    { $match: { email: { $exists: true } } },
    { $group: { _id: '$email', users: { $push: '$$ROOT' } } },
  ]).toArray();

  const userUpdates = [];
  const contentUpdates = [];
  await Promise.all(users.map(async (record) => {
    const user = getMasterUser(record.users);
    const ids = record.users.reduce((arr, r) => {
      if (`${r._id}` === `${user._id}`) return arr;
      return [...arr, r._id];
    }, []);
    if (!ids.length) return;
    contentUpdates.push({
      updateMany: {
        filter: { createdBy: { $in: ids } },
        update: { $set: { createdBy: user._id } },
      },
    });
    contentUpdates.push({
      updateMany: {
        filter: { updatedBy: { $in: ids } },
        update: { $set: { updatedBy: user._id } },
      },
    });
    userUpdates.push({
      deleteMany: {
        filter: { _id: { $in: ids } },
      },
    });
  }));

  if (userUpdates.length) await userColl.bulkWrite(userUpdates);
  if (contentUpdates.length) await contentColl.bulkWrite(contentUpdates);
};

const setPasswords = async (coll) => {
  log('Setting passwords');
  const devs = ['api.import', 'bkrigbaum', 'abuselt', 'jbare', 'jworden', 'jpalamar', 'bmiller', 'cknudsvig', 'jlaird'];
  const users = await coll.find({ username: { $nin: devs } }).toArray();
  const updates = await Promise.all(users.map(async ({ username }) => {
    const hashed = await bcrypt.hash(`${username}merge!2o20`, 10);
    const password = hashed.replace('$2b$', '$2y$');
    return {
      updateOne: {
        filter: { username },
        update: { $set: { password, mustChange: true } },
      },
    };
  }));
  if (updates.length) await coll.bulkWrite(updates);
};

const main = async () => {
  log(`\nMongo connected using ${MONGO_DSN} for ${TENANT_KEY}`);
  const connection = await client.connect();
  connection.setMaxListeners(0);
  const user = await client.collection(`${TENANT_KEY}_platform`, 'User');
  const content = await client.collection(`${TENANT_KEY}_platform`, 'Content');

  await updateDeveloper(user, content);
  await dedupeUsers(user, content);
  await setPasswords(user);

  log('Complete!\n');
  await connection.close();
};

process.on('unhandledRejection', (e) => { throw e; });
main().catch((e) => setImmediate(() => { throw e; }));
