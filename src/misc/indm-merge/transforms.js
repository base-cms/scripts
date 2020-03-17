const { iterateCursor } = require('@base-cms/db/utils');

const { log } = console;
const targetPrefix = 'indm_multi';

const getScheduleDb = (type) => {
  switch (type) {
    case 'Newsletter':
      return 'email';
    case 'Publication':
      return 'magazine';
    default:
      return 'website';
  }
};

const simpleRef = async (doc, client, db, key, collection = 'Schedule') => {
  const coll = await client.collection(`${targetPrefix}_${db}`, collection);
  return coll.updateMany({
    'legacy.source': doc.legacy.source,
    [key]: doc.legacy.id,
  }, { $set: { [key]: doc._id } });
};

const multiSimpleRef = async (doc, client, db, key, collection) => {
  const coll = await client.collection(`${targetPrefix}_${db}`, collection);
  // Insert new ID
  await coll.updateMany({
    'legacy.source': doc.legacy.source,
    [key]: doc.legacy.id,
  }, { $addToSet: { [key]: doc._id } });
  // remove old ID
  await coll.updateMany({
    'legacy.source': doc.legacy.source,
    [key]: doc.legacy.id,
  }, { $pull: { [key]: doc.legacy.id } });
};

const multiRef = async (doc, client, db, key, collection) => {
  const coll = await client.collection(db, collection);
  const ref = {
    $ref: collection,
    $id: doc._id,
    $db: db,
    type: doc.type,
  };
  const field = `${key}.$id`;
  await coll.updateMany({
    'legacy.source': doc.legacy.source,
    [field]: doc.legacy.id,
  }, { $addToSet: { [key]: ref } });
  // remove old ID
  await coll.updateMany({
    'legacy.source': doc.legacy.source,
    [field]: doc.legacy.id,
  }, { $pull: { [field]: doc.legacy.id } });
};

const resolveEmailSection = (doc, client) => Promise.all([
  simpleRef(doc, client, 'email', 'section'),
  simpleRef(doc, client, 'configuration', 'section', 'EmailBlock'),
]);
const resolveMagazineIssue = (doc, client) => simpleRef(doc, client, 'magazine', 'issue');
const resolveMagazineSection = (doc, client) => simpleRef(doc, client, 'magazine', 'section');
const resolveWebsiteOption = (doc, client) => Promise.all([
  simpleRef(doc, client, 'website', 'option'),
  async () => {
    const coll = await client.collection(`${targetPrefix}_platform`, 'Content');
    return coll.updateMany({
      'legacy.source': doc.legacy.source,
      sectionQuery: { $elemMatch: { optionId: doc.legacy.id } },
    }, { $set: { 'sectionQuery.$.optionId': doc._id } });
  },
]);

const resolvePlatformTaxonomy = async (doc, client) => Promise.all([
  simpleRef(doc, client, 'platform', 'mutations.Website.primaryCategory.$id', 'Content'),
  multiRef(doc, client, 'platform', 'taxonomy', 'Content'),
  // ...
]);

const resolvePlatformContent = async (doc, client) => Promise.all([
  simpleRef(doc, client, 'platform', 'company', 'Content'),
  multiRef(doc, client, 'platform', 'relatedTo', 'Content'),
]);

const resolveConfigurationEmail = async (doc, client) => Promise.all([
  simpleRef(doc, client, 'configuration', 'configuration', 'EmailBlock'),
  // multiRef(doc, client, 'platform', 'relatedTo', 'Content'),
]);

const resolvePlatformUser = async (doc, client) => Promise.all([
  simpleRef(doc, client, 'platform', 'createdBy', 'Content'),
  simpleRef(doc, client, 'platform', 'updatedBy', 'Content'),
]);

const resolveWebsiteSection = async (doc, client) => Promise.all([
  simpleRef(doc, client, 'website', 'section'),
  simpleRef(doc, client, 'platform', 'mutations.Website.primarySection.$id', 'Content'),
  simpleRef(doc, client, 'configuration', 'websiteSection', 'EmailBlock'),
  async () => {
    const coll = await client.collection(`${targetPrefix}_platform`, 'Content');
    return coll.updateMany({
      'legacy.source': doc.legacy.source,
      sectionQuery: { $elemMatch: { sectionId: doc.legacy.id } },
    }, { $set: { 'sectionQuery.$.sectionId': doc._id } });
  },
]);

const resolvePlatformProduct = async (doc, client) => Promise.all([
  simpleRef(doc, client, getScheduleDb(doc.type), 'product'),
  simpleRef(doc, client, 'platform', 'mutations.Website.primarySite', 'Content'),
  simpleRef(doc, client, 'configuration', 'newsletter', 'Email'),
  simpleRef(doc, client, 'configuration', 'publication', 'EmailBlock'),
]);

const resolvePlatformAsset = async (doc, client) => Promise.all([
  simpleRef(doc, client, 'website', 'logo', 'Section'),
  simpleRef(doc, client, 'website', 'coverImage', 'Section'),
  simpleRef(doc, client, 'platform', 'primaryImage', 'Content'),
  simpleRef(doc, client, 'configuration', 'headerLeft', 'EmailBlock'),
  simpleRef(doc, client, 'configuration', 'headerRight', 'EmailBlock'),
  multiSimpleRef(doc, client, 'platform', 'images', 'Content'),
]);

// nothing to do here, no indirect refs
const resolvePlatformEntity = (v) => v;
const resolveConfigurationEmailBlock = (v) => v;

module.exports = async (client, key, coll, cursor) => {
  const count = await cursor.count();
  log(`Resolving ${count} conflicts for ${key}.${coll}...`);
  switch (`${key}.${coll}`) {
    case 'configuration.Email': return iterateCursor(cursor, (doc) => resolveConfigurationEmail(doc, client));
    case 'configuration.EmailBlock': return iterateCursor(cursor, (doc) => resolveConfigurationEmailBlock(doc, client));
    case 'email.Section': return iterateCursor(cursor, (doc) => resolveEmailSection(doc, client));
    case 'magazine.Issue': return iterateCursor(cursor, (doc) => resolveMagazineIssue(doc, client));
    case 'magazine.Section': return iterateCursor(cursor, (doc) => resolveMagazineSection(doc, client));
    case 'platform.Asset': return iterateCursor(cursor, (doc) => resolvePlatformAsset(doc, client));
    case 'platform.Content': return iterateCursor(cursor, (doc) => resolvePlatformContent(doc, client));
    case 'platform.Entity': return iterateCursor(cursor, (doc) => resolvePlatformEntity(doc, client));
    case 'platform.Product': return iterateCursor(cursor, (doc) => resolvePlatformProduct(doc, client));
    case 'platform.Taxonomy': return iterateCursor(cursor, (doc) => resolvePlatformTaxonomy(doc, client));
    case 'platform.User': return iterateCursor(cursor, (doc) => resolvePlatformUser(doc, client));
    case 'website.Option': return iterateCursor(cursor, (doc) => resolveWebsiteOption(doc, client));
    case 'website.Section': return iterateCursor(cursor, (doc) => resolveWebsiteSection(doc, client));

    default:
      // log(`Can't resolve ${key}.${coll}!`);
      throw new Error(`Unable to resolve ${key}.${coll}!`);
  }
};
