const { iterateCursor } = require('@base-cms/db/utils');

const { log } = console;

module.exports = async ({ content: contentColl }) => {
  log('Retrieving legacy products for packworld...');

  const nids = await contentColl.distinct('legacy.raw.field_companies.und.0.nid', {
    'legacy.source': 'pw_node',
    'legacy.raw.field_term_subtype.und.tid': { $in: ['174', '175'] },
  });

  const cursor = await contentColl.find({
    'legacy.source': 'pw_node',
    type: 'Company',
    'legacy.id': { $in: nids },
  }, { projection: { _id: 1 } });

  const results = [];
  await iterateCursor(cursor, async (doc) => {
    const { _id } = doc;

    const filter = {
      'legacy.source': 'pw_node',
      'legacy.raw.field_term_subtype.und.tid': { $in: ['174', '175'] },
      'relatedTo.$id': _id,
    };

    const update = {
      type: 'Product',
      company: _id,
    };

    const $set = { ...update };

    results.push({ filter, $set });
  });

  log(`Found ${results.length} items to update.`);

  return {
    multi: true,
    updates: { content: results },
  };
};
