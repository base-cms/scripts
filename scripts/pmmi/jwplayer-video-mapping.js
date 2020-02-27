const { iterateCursor } = require('@base-cms/db/utils');
const { get } = require('@base-cms/object-path');
const path = require('path');
// const { inspect } = require('util');
const readCsv = require('../../src/utils/csv-read');
const writeCsv = require('../../src/utils/csv-write');

const { log } = console;
const file = path.join(process.cwd(), 'data/pmmi/video-migration-data.csv');
const headers = [
  { id: 'jwplayer_id', title: 'jwplayer_id' },
  { id: 'viddler_id', title: 'viddler_id' },
  { id: 'base_id', title: 'base_id' },
];

module.exports = async ({ content }) => {
  log('Loading CSV');
  const entries = await readCsv(file);
  const ids = entries.map((e) => e.viddler_id);

  log('Querying for videos');
  const cursor = await content.find({
    'legacy.raw.field_viddler_id.und.value': { $in: ids },
  }, {
    projection: {
      'legacy.raw.field_viddler_id.und.value': 1,
    },
  });

  log('Updating CSV data');
  await iterateCursor(cursor, async (doc) => {
    const viddlerId = get(doc, 'legacy.raw.field_viddler_id.und.0.value');
    const index = entries.findIndex((e) => viddlerId === e.viddler_id);
    if (index !== -1) {
      entries[index].base_id = doc._id;
    } else {
      log(doc._id, 'viddlerId not in csv');
    }
    // log(inspect(doc, { depth: 10 }));
  });

  log('Writing CSV');
  await writeCsv(file, headers, entries);

  const updates = [];
  return { updates };
};
