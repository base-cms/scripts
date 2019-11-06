const { iterateCursor } = require('@base-cms/db/utils');
const { getAsObject } = require('@base-cms/object-path');

const { log } = console;

module.exports = async (contentColl) => {
  log('Retrieving non-iframe videos...');

  const cursor = await contentColl.find({
    'legacy.source': { $exists: true },
    type: 'Video',
    embedCode: { $regex: /data-video-id/i },
  }, { projection: { embedCode: 1 } });

  const results = [];
  await iterateCursor(cursor, async (doc) => {
    const { _id } = doc;

    const regex = /data-video-id="(?<videoId>\d+)"(?:.|\r|\n)*account="(?<accountId>\d+)"(?:.|\r|\n)*data-player="(?<playerId>[a-z0-9-]+)"(?:.|\r|\n)*data-embed="(?<embed>[a-z0-9]+)"/igm;
    const matches = regex.exec(doc.embedCode);

    const {
      accountId,
      videoId,
      playerId,
      embed = 'default',
    } = getAsObject(matches, 'groups');
    if (!accountId || !videoId || !playerId) return;

    const embedCode = `<iframe src="https://players.brightcove.net/${accountId}/${playerId}_${embed}/index.html?videoId=${videoId}" allowfullscreen="" allow="encrypted-media"></iframe>`;

    const filter = { _id };
    const $set = {
      'legacy.script.embedCode': doc.embedCode,
      embedCode,
    };

    results.push({ filter, $set });
  });

  log(`Found ${results.length} items to update.`);

  return results;
};
