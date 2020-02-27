const fs = require('fs');
const CsvReadableStream = require('csv-reader');
const objectify = require('./objectify');

module.exports = (file) => new Promise((resolve, reject) => {
  try {
    const rows = [];
    const stream = fs.createReadStream(file, 'utf8');
    stream
      .pipe(CsvReadableStream({ parseNumbers: true, parseBooleans: true, trim: true }))
      .on('data', (row) => rows.push(row))
      .on('finish', () => resolve(objectify(rows)));
  } catch (e) {
    reject(e);
  }
});
