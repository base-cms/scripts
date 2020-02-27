const { createObjectCsvWriter } = require('csv-writer');

/**
 * @param {String} path     The path to the file to write
 * @param {Object} header[] An array of { id, title } for CSV headers
 * @param {Array}  data     The data to write
 */
module.exports = async (path, header = [], data = []) => createObjectCsvWriter({ path, header })
  .writeRecords(data);
