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
const { createMongoClient, MongoDB: { ObjectID } } = require('@base-cms/db');
const { iterateCursor } = require('@base-cms/db/utils');
const { getAsArray } = require('@base-cms/object-path');
const deserialize = require('./deserialize');
const resolveConflicts = require('./transforms');
const buildSectionQuery = require('../../../scripts/build-section-query');
const { MONGO_DSN } = require('../../env');

const client = createMongoClient(MONGO_DSN, { appname: '@base-cms/scripts', useUnifiedTopology: true });
const { log } = console;

const source = process.argv.pop();
if (!source || !/^\w+$/.test(source)) throw new Error(`Source parameter is required, encountered "${source}".`);

const targetPrefix = 'indm_multi';
const databases = [
  'configuration',
  'email',
  'magazine',
  'website',
  'platform',
];

const collections = {
  configuration: [
    'Email',
    'EmailBlock',
  ],
  email: [
    'Campaign',
    'Section',
    'Schedule',
  ],
  magazine: [
    'Issue',
    'Section',
    'Schedule',
  ],
  website: [
    'Section',
    'Option',
    'Redirects',
    'Page',
    'Schedule',
  ],
  platform: [
    'Asset',
    'Content',
    'Entity',
    'ModelAccess',
    'Product',
    'Taxonomy',
    'User',
  ],
};

const generateIdFor = async (collection) => {
  const keys = ['Content', 'Issue', 'Section', 'Option', 'Taxonomy'];
  if (keys.includes(collection)) {
    const idGenerator = await client.collection('platform', 'IdGenerator');
    const update = { $inc: { sequence: 1 } };
    const { value } = await idGenerator.findOneAndUpdate(
      { _id: collection },
      update,
      { returnOriginal: false },
    );
    return parseInt(value.sequence, 10) + parseInt(value.start, 10);
  }
  return new ObjectID();
};

const mergeAll = async () => {
  const sourcePrefix = 'indm_all';
  log(`\nMigrating ${sourcePrefix} databases.\n`);

  if (MONGO_DSN.includes('baseplatform.io')) {
    throw new Error('Do not use `all` in production. Use `bootstrap.sh` instead!');
  }

  // Drop stupid collections
  await Promise.all([
    { db: `${sourcePrefix}_platform`, coll: 'Configuration' },
    { db: `${sourcePrefix}_platform`, coll: 'Customer' },
    { db: `${sourcePrefix}_platform`, coll: 'Group' },
    { db: `${sourcePrefix}_platform`, coll: 'Identity' },
    { db: `${sourcePrefix}_platform`, coll: 'Inquiry' },
    { db: `${sourcePrefix}_platform`, coll: 'OpticatProduct' },
    { db: `${sourcePrefix}_platform`, coll: 'Post' },
    { db: `${sourcePrefix}_platform`, coll: 'PostStream' },
    { db: `${sourcePrefix}_platform`, coll: 'Subscription' },
    { db: `${sourcePrefix}_platform`, coll: 'Survey' },
    { db: `${sourcePrefix}_platform`, coll: 'Syndication' },
  ].map(async (ref) => {
    try {
      const db = await client.db(ref.db);
      log(`SKIPPED -- Dropping ${ref.db}.${ref.coll}`);
      // await db.dropCollection(ref.coll);
      await db.stats();
    } catch (e) {
      log(`Unable to drop ${ref.db}.${ref.coll}`);
    }
    return undefined;
  }));

  await Promise.all(databases.map(async (suffix) => {
    const targetDb = `${targetPrefix}_${suffix}`;
    log(`Dropping ${targetDb}...`);
    const db = await client.db(targetDb);
    return db.dropDatabase();
  }));

  const admin = await client.admin();
  await Promise.all(databases.map(async (suffix) => {
    const sourceDb = `${sourcePrefix}_${suffix}`;
    const targetDb = `${targetPrefix}_${suffix}`;
    log(`Copying ${sourceDb} to ${targetDb}...`);
    return new Promise((resolve, reject) => {
      admin.command({
        copydb: 1,
        fromhost: 'localhost',
        fromdb: sourceDb,
        todb: targetDb,
      }, (err, data) => {
        if (err) reject(err);
        resolve(data);
      });
    });
  }));

  log('\nDone migrating databases!');
};

const merge = async (group, account = 'indm') => {
  const sourcePrefix = `${account}_${group}`;

  await Promise.all(Object.keys(collections).map(async (key) => {
    const sourceDb = `${sourcePrefix}_${key}`;
    const targetDb = `${targetPrefix}_${key}`;
    const sdb = await client.db(sourceDb);
    const db = await client.db(targetDb);

    log(`Inserting legacy documents from ${sourceDb}`);
    await Promise.all(collections[key].map(async (collection) => {
      const coll = db.collection(collection);
      const scoll = sdb.collection(collection);
      const cursor = await scoll.find({}, { sort: { _id: 1 }, raw: true });
      log(`${targetDb}.${collection}: > Creating legacy index`);
      await coll.createIndex({ 'legacy.source': 1, 'legacy.id': 1 }, { background: true });
      log(`${targetDb}.${collection}: > Building bulk operations`);

      const bulkOps = [];
      await iterateCursor(cursor, (buffer) => {
        const doc = deserialize(buffer);
        const legacy = { source: sourcePrefix, id: doc._id };
        bulkOps.push({
          updateOne: {
            filter: {
              'legacy.source': legacy.source,
              'legacy.id': legacy.id,
            },
            update: { $set: { ...doc, legacy } },
            upsert: true,
          },
        });
      });

      try {
        if (bulkOps.length) {
          log(`${targetDb}.${collection}: >> Updating ${bulkOps.length} documents`);
          await coll.bulkWrite(bulkOps, { ordered: false });
        } else {
          log(`${targetDb}.${collection}: >> Skipping, ${bulkOps.length} documents to update`);
        }
      } catch (e) {
        log(`${targetDb}.${collection}: >>> Building conflicted bulk operations`);
        const errors = e.result.getWriteErrors();
        const bulkInserts = [];
        await Promise.all(errors.map(async (error) => {
          const id = await generateIdFor(collection);
          const { u: { $set } } = error.getOperation();
          const { _id, legacy, ...doc } = $set;
          bulkInserts.push({
            updateOne: {
              filter: {
                'legacy.source': legacy.source,
                'legacy.id': legacy.id,
              },
              update: {
                $set: {
                  ...doc,
                  legacy: {
                    ...legacy,
                    conflict: true,
                  },
                },
                $setOnInsert: { _id: id },
              },
              upsert: true,
            },
          });
        }));

        log(`${targetDb}.${collection}: >>>> Updating ${bulkInserts.length} conflicted documents`);
        await coll.bulkWrite(bulkInserts, { ordered: false });
      }
    }));

    // Update all website.Option names
    if (key === 'website') {
      log(`${targetDb}.Option: Updating option names`);
      const coll = db.collection('Option');
      await coll.bulkWrite([
        {
          updateMany: {
            filter: { name: { $in: ['Standard Web'] } },
            update: { $set: { name: 'Standard' } },
          },
        },
        {
          updateMany: {
            filter: { name: { $in: ['Pinned'] } },
            update: { $set: { name: 'Featured Content' } },
          },
        },
      ]);
    }

    log('Updating orphaned references');
    await Promise.all(collections[key].map(async (collection) => {
      const coll = db.collection(collection);
      const cursor = await coll.find({
        'legacy.source': sourcePrefix,
        'legacy.conflict': true,
      }, { sort: { _id: 1 } });
      const count = await cursor.count();
      if (count) await resolveConflicts(client, key, collection, cursor);
    }));
  }));

  log('Rebuilding sectionQuery data');
  const content = await client.collection(`${targetPrefix}_platform`, 'Content');
  const schedule = await client.collection(`${targetPrefix}_website`, 'Schedule');
  const updates = await buildSectionQuery({ content, schedule });
  const bulkOps = getAsArray(updates, 'updates.content').map(({ filter, $set }) => ({ updateOne: { filter, update: $set } }));
  if (bulkOps.length) {
    log(`Writing ${bulkOps.length} sectionQuery updates...`);
    await content.bulkWrite(bulkOps, { ordered: false });
  }
};

const main = async () => {
  log(`\nMongo connected using ${MONGO_DSN} for ${source}`);
  const connection = await client.connect();
  connection.setMaxListeners(0);

  switch (source) {
    case 'all':
      await mergeAll();
      break;
    default:
      await merge(source);
      break;
  }
  // const coll = await client.collection('identity-x-legacy-data', source);
  // const user = await client.collection('identity-x', 'app-users');

  // log('Transforming users.');
  // const transformed = await transform(cursor);
  // log(`Transformed ${transformed.length} users.`);
  // const updates = buildUpdates(filter(transformed));
  // log('Creating index...');
  // await user.createIndex({ 'legacy.id': 1, 'legacy.source': 1 });
  // log(`Updating ${updates.length} users...`);
  // await user.bulkWrite(updates, { ordered: false });
  log('Complete!\n');
  await connection.close();
};

process.on('unhandledRejection', (e) => { throw e; });
main().catch((e) => setImmediate(() => { throw e; }));
