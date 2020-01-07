#!/usr/bin/env node

/* eslint-disable no-await-in-loop */
const { Base4RestApiClient, Base4RestPayload } = require('@base-cms/base4-rest-api');
const { MongoDB: { ObjectID } } = require('@base-cms/db');
const fs = require('fs');
const CsvReadableStream = require('csv-reader');
const createDB = require('../create-db');
const {
  BASE4_API_URL,
  BASE4_USERNAME,
  BASE4_PASSWORD,
  TENANT_KEY,
} = require('./env');

const { log } = console;
const basedb = createDB(TENANT_KEY);
const apiClient = new Base4RestApiClient({
  uri: BASE4_API_URL,
  username: BASE4_USERNAME,
  password: BASE4_PASSWORD,
});

const objectify = (rows = []) => {
  const headers = rows.slice(0, 1).pop();
  // log(headers);
  return rows.slice(1).map((row) => ({
    ...(headers[0] && { [headers[0]]: `${row[0]}`.trim() }),
    ...(headers[1] && { [headers[1]]: `${row[1]}`.trim() }),
    ...(headers[2] && { [headers[2]]: `${row[2]}`.trim() }),
    ...(headers[3] && { [headers[3]]: `${row[3]}`.trim() }),
    ...(headers[4] && { [headers[4]]: `${row[4]}`.length ? `${row[4]}`.trim().split(',') : [] }),
  }));
};

const readCsv = (file) => new Promise((resolve, reject) => {
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

const parents = {};
const setParent = (alias, siteId, id) => {
  if (!parents[alias]) parents[alias] = {};
  parents[alias][siteId] = id;
};
const resolveParent = async (parentAlias, siteId) => {
  if (!parentAlias) return null;
  if (parents[parentAlias] && parents[parentAlias][siteId]) return parents[parentAlias][siteId];
  const { _id } = await basedb.findOne('website.Section', { alias: parentAlias, site: ObjectID(siteId) }, { projection: { _id: 1 } });
  setParent(parentAlias, siteId, _id);
  return parents[parentAlias][siteId];
};

const buildPayload = async ({
  type = 'website/section',
  parentAlias,
  siteId,
  name,
  alias,
  relatedTaxonomyIds,
}) => {
  const parentId = await resolveParent(parentAlias, siteId);
  const payload = new Base4RestPayload({ type });
  payload.set('name', name);
  payload.set('alias', alias);
  payload.setLink('site', { type: 'website/product/site', id: siteId });
  if (parentId) payload.setLink('parent', { type, id: parentId });
  if (relatedTaxonomyIds) {
    payload.setLinks('relatedTaxonomy', relatedTaxonomyIds
      .map((id) => ({ type: 'platform/taxonomy/category', id })));
  }
  return payload;
};

const createSection = async (body) => {
  const { data: { alias, links } } = body;
  const siteId = links.site.linkage.id;
  const section = await basedb.findOne('website.Section', { alias, 'site.$id': ObjectID(siteId) }, { projection: { _id: 1 } });
  if (section) {
    log(`found section ${section._id} for ${alias} (${siteId}).`);
    setParent(alias, siteId, section._id);
    return { id: section.id };
  }
  log(`creating section ${body.data.alias}...`);
  const { data: { id } } = await apiClient.insertOne({ model: 'website/section', body });
  setParent(alias, siteId, id);
  return { id };
};

const createSections = async (file) => {
  const sections = await readCsv(file);
  log(file, sections.length);

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const payload = await buildPayload(section);
    await createSection(payload);
  }
};

const main = async () => {
  const [account, group] = TENANT_KEY.split('_');
  await createSections(`data/${account}/${group}.csv`);
  process.exit(0);
};

main().catch((e) => setImmediate(() => { throw e; }));
