const { iterateCursor } = require('@base-cms/db/utils');
const { get } = require('@base-cms/object-path');

const { log } = console;

module.exports = async (contentColl) => {
  log('Retrieving document references...');

  const projection = {
    'legacy.raw.field_content_pdf': 1,
    name: 1,
    fileName: 1,
  };

  const cursor = await contentColl.find({
    type: { $ne: 'Document' },
    'legacy.raw.field_content_pdf.und.fid': { $exists: true },
  }, { projection });

  const results = [];
  await iterateCursor(cursor, async (doc) => {
    const legacyId = get(doc, 'legacy.raw.field_content_pdf.und.0.fid');
    const pdf = await contentColl.findOne({ type: 'Document', 'legacy.id': parseInt(legacyId, 10) }, { projection });
    if (!pdf) return;

    const { fileName, name, _id } = pdf;

    if (name.trim() !== fileName.trim()) return;

    const $set = {
      name: `Download: ${doc.name}`,
    };

    results.push({ filter: { _id }, $set });
  });

  log(`Found ${results.length} files.`);

  return results;
};
