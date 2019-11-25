const { inspect } = require('util');
const createDB = require('./create-db');

const { log } = console;
const { TENANT_KEY } = process.env;
const basedb = createDB(TENANT_KEY);

const buildUpdates = (updates, key, updateKey) => {
  const arr = updates[key] || [];
  return arr.map(({
    filter,
    $set,
    $addToSet,
    $unset,
  }) => ({
    [updateKey]: {
      filter,
      update: {
        ...($set && { $set }),
        ...($addToSet && { $addToSet }),
        ...($unset && { $unset }),
      },
    },
  }));
};

module.exports = async (fn, write = false, debug = true) => {
  try {
    const client = await basedb.client.connect();
    log(`BaseCMS DB connected to ${client.s.url} for ${basedb.tenant}`);

    const contentColl = await basedb.collection('platform', 'Content');
    const scheduleColl = await basedb.collection('website', 'Schedule');

    const collections = {
      content: contentColl,
      schedule: scheduleColl,
    };

    const { multi, updates } = await fn(collections);
    const updateKey = multi ? 'updateMany' : 'updateOne';

    const bulkOps = Object.keys(collections).reduce((obj, key) => {
      const ops = buildUpdates(updates, key, updateKey);
      if (!ops.length) return obj;
      ops.forEach(({ [updateKey]: update }) => {
        // An operator is mandatory. Don't fuck it up.
        if (!Object.keys(update.update).length) throw new Error('No $operator sent with update!');
      });
      return { ...obj, [key]: ops };
    }, {});


    if (!Object.keys(bulkOps).length) {
      log('No bulk operations available!');
      await basedb.close();
      return;
    }

    if (debug) {
      log(inspect(bulkOps, { colors: true, depth: 10 }));
    }

    if (write) {
      const promises = Object.keys(bulkOps).map(async (key) => {
        const coll = collections[key];
        log(`Beginning ${key} bulk write process...`);
        const { matchedCount } = await coll.bulkWrite(bulkOps);
        log('Bulk write complete.', matchedCount);
      });
      await Promise.all(promises);
    }

    await basedb.close();
  } catch (e) {
    setImmediate(() => { throw e; });
  }
};
