const { iterateCursor } = require('@base-cms/db/utils');
const { get } = require('@base-cms/object-path');
const dataFilter = require('../../src/data-filter');
const dataMapper = require('../../src/data-mapper');

const { log } = console;

module.exports = async ({ content: contentColl }) => {
  log('Retrieving videos without embed codes...');

  const fields = ['embedCode'];
  const drupalFields = { embedCode: 'viddler_id' };
  const projection = fields.reduce((obj, field) => ({ ...obj, [field]: 1 }), {});
  projection.legacy = 1;

  const cursor = await contentColl.find({
    type: 'Video',
    embedCode: { $exists: false },
    'legacy.raw.field_viddler_id': { $exists: true },
    'legacy.source': { $exists: true },
  }, { projection });

  const results = [];
  await iterateCursor(cursor, async (doc) => {
    const { _id } = doc;

    const update = {};
    const data = dataFilter({ doc, fields, map: drupalFields });

    dataMapper({
      data,
      doc,
      fn: ({ value, field }) => {
        if (!update[field]) {
          update[field] = `<iframe id="viddler-${value}" src="https://www.viddler.com/embed/${value}/?f=1&player=full" width="650" height="408" frameborder="0" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>`;
        }
      },
    });

    // log(doc._id);
    // log(inspect(data));
    // log(inspect(update));

    const oks = Object.keys(update);
    if (!oks.length) return;

    const $addToSet = {
      // ...
    };

    const $set = {
      ...oks.reduce((obj, k) => {
        const v = get(doc, k);
        const n = `legacy.script.${k}`;
        return v ? { ...obj, [n]: v } : obj;
      }, {}),
      ...update,
    };

    results.push({
      filter: { _id },
      $set,
      ...(Object.keys($addToSet).length && { $addToSet }),
    });
  });

  log(`Found ${results.length} items to update.`);

  return {
    multi: false,
    updates: { content: results },
  };
};
