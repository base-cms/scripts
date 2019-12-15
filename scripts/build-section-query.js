const moment = require('moment');

const { log } = console;

module.exports = async ({ content: contentColl, schedule: scheduleColl }) => {
  log('Retrieving aggregated schedules...');
  const maxDate = moment('2038-01-01T00:00:00Z').toDate();
  const cursor = await scheduleColl.aggregate([
    {
      $match: {
        status: 1,
        contentStatus: 1,
        published: { $exists: true },
        section: { $exists: true },
        option: { $exists: true },
        'content.$id': { $exists: true },
      },
    },
    { $addFields: { contentArray: { $objectToArray: '$content' } } },
    { $unwind: '$contentArray' },
    { $match: { 'contentArray.k': '$id' } },
    {
      $project: {
        contentId: '$contentArray.v',
        sectionId: '$section',
        optionId: '$option',
        start: {
          $cond: {
            if: { $gt: ['$startDate', '$published'] },
            then: '$startDate',
            else: '$published',
          },
        },
        end: {
          $cond: {
            if: {
              $lt: [
                { $ifNull: ['$endDate', maxDate] },
                { $ifNull: ['$expires', maxDate] },
              ],
            },
            then: '$endDate',
            else: '$expires',
          },
        },
      },
    },
    { $sort: { start: -1 } },
    {
      $group: {
        _id: '$contentId',
        schedules: {
          $push: {
            sectionId: '$sectionId',
            optionId: '$optionId',
            start: '$start',
            end: '$end',
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        contentId: '$_id',
        schedules: 1,
      },
    },
  ], { allowDiskUse: true });

  const docs = await cursor.toArray();

  const results = docs.map((doc) => ({
    filter: { _id: doc.contentId },
    $set: { sectionQuery: doc.schedules },
  }));

  log('Creating indices...');
  await Promise.all([
    contentColl.createIndex({ 'sectionQuery.sectionId': 1, 'sectionQuery.optionId': 1 }),
    contentColl.createIndex({ 'sectionQuery.sectionId': 1, 'sectionQuery.optionId': 1, primaryImage: 1 }),
    contentColl.createIndex({ 'sectionQuery.start': -1, _id: -1 }),
    contentColl.createIndex({ 'sectionQuery.end': -1, _id: -1 }),
  ]);
  log('Indexing complete.');

  return {
    multi: false,
    updates: {
      content: results,
    },
  };
};
