const { iterateCursor } = require('@base-cms/db/utils');
const { get } = require('@base-cms/object-path');

const { log } = console;

module.exports = async (contentColl) => {
  log('Retrieving missing company refs...');

  const nids = await contentColl.distinct('legacy.raw.field_companies.und.0.nid', {
    type: { $ne: 'Company' },
    'legacy.raw.field_companies.und.nid': { $exists: true },
    'relatedTo.type': { $ne: 'Company' },
  });

  const cursor = await contentColl.find({
    type: 'Company',
    'legacy.id': { $in: nids },
  }, { projection: { _id: 1, 'legacy.id': 1, 'legacy.source': 1 } });

  const results = [];
  await iterateCursor(cursor, async (doc) => {
    const { _id } = doc;
    const legacyId = get(doc, 'legacy.id');
    const source = get(doc, 'legacy.source');

    const filter = {
      'legacy.source': source,
      'legacy.raw.field_companies.und.nid': `${legacyId}`,
    };

    const $addToSet = {
      relatedTo: {
        $ref: 'Content',
        $id: _id,
        $db: 'pmmi_all_platform',
        type: 'Company',
      },
    };

    results.push({ filter, $addToSet });
  });

  log(`Found ${results.length} items to update.`);

  return {
    multi: true,
    updates: results,
  };
};
