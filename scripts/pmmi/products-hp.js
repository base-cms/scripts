const { iterateCursor } = require('@base-cms/db/utils');

const { log } = console;

module.exports = async (contentColl) => {
  log('Retrieving legacy products for healthcarepackaging...');

  const nids = await contentColl.distinct('legacy.raw.field_companies.und.0.nid', {
    'legacy.source': 'hp_node',
    'legacy.raw.field_term_subtype.und.tid': { $in: ['176', '6501', '6500', '6502'] },
  });

  const cursor = await contentColl.find({
    'legacy.source': 'hp_node',
    type: 'Company',
    'legacy.id': { $in: nids },
  }, { projection: { _id: 1 } });

  const results = [];
  await iterateCursor(cursor, async (doc) => {
    const { _id } = doc;

    const filter = {
      'legacy.source': 'hp_node',
      'legacy.raw.field_term_subtype.und.tid': { $in: ['176', '6501', '6500', '6502'] },
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

  return results;
};
