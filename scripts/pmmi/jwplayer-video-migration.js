const path = require('path');
const readCsv = require('../../src/utils/csv-read');

const { log } = console;
const file = path.join(process.cwd(), 'data/pmmi/video-migration-data-3.csv');
const playerId = '1CPNQyoa'; // jwplatform default 16x9
// const playerId = 'BLa7MAJY'; // pmmi default 16x9

module.exports = async () => {
  log('Loading CSV');
  const entries = await readCsv(file);

  const updates = entries.filter((entry) => entry.base_id).map((entry) => {
    const sourceId = `${entry.jwplayer_id}-${playerId}`;
    const embedCode = `<iframe src="https://cdn.jwplayer.com/players/${sourceId}.html"></iframe>`;
    return { filter: { _id: parseInt(entry.base_id, 10) }, $set: { embedCode, sourceId } };
  });
  return { updates: { content: updates } };
};

// <iframe src="https://cdn.jwplayer.com/players/QYqxXkZn-1CPNQyoa.html"></iframe>
