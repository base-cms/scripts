#!/usr/bin/env node

const { createMongoClient, MongoDB: { ObjectID } } = require('@base-cms/db');
const { iterateCursor } = require('@base-cms/db/utils');
const { MONGO_DSN } = require('../../env');
const {
  formatEmail,
  formatCountry,
  formatNames,
  formatOrganization,
  formatOrganizationTitle,
  formatDate,
} = require('./transforms');

const client = createMongoClient(MONGO_DSN, { appname: '@base-cms/scripts', useUnifiedTopology: true });
const { log } = console;

const source = process.argv.pop();
if (!source || !/^\w+$/.test(source)) throw new Error(`Source parameter is required, encountered "${source}".`);

const appIds = {
  ogj: new ObjectID('5cf67e2221be593b13b30edf'),
  asumag: new ObjectID('5df0073005aa561c3543fbfd'),
  contractingbusiness: new ObjectID('5df0078f05aa56a96943fbfe'),
  contractormag: new ObjectID('5df007a505aa563aa043fbff'),
  ecmweb: new ObjectID('5df007b605aa565ec343fc00'),
  electricalmarketing: new ObjectID('5df007c705aa56547d43fc01'),
  ewweb: new ObjectID('5df007e405aa56cc6c43fc02'),
  hpac: new ObjectID('5df0080805aa56af7a43fc03'),
  rermag: new ObjectID('5df0082605aa5695a243fc04'),
  tdworld: new ObjectID('5df0083505aa568f1543fc05'),
  americanmachinist: new ObjectID('5df0e82405aa56699b43fc2f'),
  bulktransporter: new ObjectID('5df0e83705aa56c6f243fc30'),
  ehstoday: new ObjectID('5df0e86e05aa56311743fc31'),
  electronicdesign: new ObjectID('5df0e87f05aa56586843fc32'),
  fleetowner: new ObjectID('5df0e89005aa56175543fc33'),
  forgingmagazine: new ObjectID('5df0e8a105aa56609143fc34'),
  foundrymag: new ObjectID('5df0e8b205aa567ebb43fc35'),
  hydraulicspneumatics: new ObjectID('5df0e8dc05aa5681de43fc36'),
  industryweek: new ObjectID('5df0e8f105aa56e67d43fc37'),
  machinedesign: new ObjectID('5df0e90605aa5648c343fc38'),
  mhlnews: new ObjectID('5df0e93805aa563dd443fc39'),
  mwrf: new ObjectID('5df0e96005aa56e86643fc3a'),
  newequipment: new ObjectID('5df0e97405aa56ad4d43fc3b'),
  powerelectronics: new ObjectID('5df0e98905aa56bf2c43fc3c'),
  refrigeratedtransporter: new ObjectID('5df0e9a805aa562e3843fc3d'),
  sourcetoday: new ObjectID('5df0e9b905aa56edd743fc3e'),
  'trailer-bodybuilders': new ObjectID('5df0e9d605aa5635d243fc3f'),
  trucker: new ObjectID('5df0e9e305aa56e43c43fc40'),
  truckfleetmro: new ObjectID('5df0ea0005aa5628cd43fc41'),
};

const applicationId = appIds[source];
if (!applicationId) throw new Error(`Unable to find an application ID for ${source}!`);

const transform = async (cursor) => {
  const results = [];
  await iterateCursor(cursor, async (doc) => {
    const { _id: id } = doc;
    const { email, domain } = await formatEmail(doc);
    const { countryCode, countryName } = await formatCountry(doc);
    const { givenName, familyName } = await formatNames(doc);
    const createdAt = await formatDate(doc.created);
    const newdoc = {
      legacy: { id, source },
      email,
      __v: 0,
      domain,
      accessLevelIds: [],
      teamIds: [],
      applicationId,
      givenName,
      familyName,
      verified: false,
      organization: await formatOrganization(doc),
      organizationTitle: await formatOrganizationTitle(doc),
      countryCode,
      countryName,
      createdAt,
    };
    results.push(newdoc);
  });
  return results;
};

const buildUpdates = (docs) => docs.map((doc) => ({
  updateOne: {
    filter: { 'legacy.id': doc.legacy.id, 'legacy.source': source },
    update: doc,
    upsert: true,
  },
}));

const main = async () => {
  const coll = await client.collection('identity-x-legacy-data', source);
  const user = await client.collection('identity-x', 'app-users');
  const cursor = await coll.find({ mail: { $exists: true } }, { projection: { raw: 0 } });

  log('Transforming users.');
  const transformed = await transform(cursor);
  log(`Transformed ${transformed.length} users.`);
  const updates = buildUpdates(transformed);
  log('Creating index...');
  await user.createIndex({ 'legacy.id': 1, 'legacy.source': 1 });
  log('Updating users...');
  await user.bulkWrite(updates);
  log('Complete!');
};

process.on('unhandledRejection', (e) => { throw e; });
main().catch((e) => setImmediate(() => { throw e; })).then(() => process.exit(0));
