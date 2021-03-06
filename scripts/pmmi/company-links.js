const { iterateCursor } = require('@base-cms/db/utils');
const { get } = require('@base-cms/object-path');
const dataFilter = require('../../src/data-filter');
const dataMapper = require('../../src/data-mapper');

const { log } = console;

module.exports = async ({ content: contentColl }) => {
  log('Retrieving all companies...');

  const fields = [
    'website',
  ];
  const projection = fields.reduce((obj, field) => ({ ...obj, [field]: 1 }), {});
  projection.legacy = 1;

  const cursor = await contentColl.find({
    type: 'Company',
    'legacy.source': { $exists: true },
    $or: [
      { 'legacy.ldc.field_link': { $exists: true } },
      { 'legacy.lpc.field_link': { $exists: true } },
      { 'legacy.lop.field_link': { $exists: true } },
      { 'legacy.raw.field_link': { $exists: true } },
    ],
    status: 1,
    // _id: 13374608,
  }, { projection });

  const results = [];
  await iterateCursor(cursor, async (doc) => {
    const { _id, website } = doc;

    const update = {
      'legacy.script.website': website,
    };
    delete doc.website; // eslint-disable-line no-param-reassign

    const data = dataFilter({ doc, fields, map: { website: 'field_link' } });

    dataMapper({
      data,
      doc,
      fn: ({ value, field }) => {
        if (!update[field]) {
          update[field] = /^http/.test(value) ? value : `http://${value}`;
        }
      },
    });

    if (update.website === update['legacy.script.website']) return;

    // log(inspect(doc._id));
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

    const $unset = {
      embedCode: 1,
    };

    results.push({
      filter: { _id },
      $set,
      ...(Object.keys($addToSet).length && { $addToSet }),
      ...(Object.keys($unset).length && { $unset }),
    });
  });

  log(`Found ${results.length} items to update.`);

  return {
    multi: false,
    updates: { content: results },
  };
};
