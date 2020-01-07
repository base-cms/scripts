/* eslint-disable no-await-in-loop */
const fetch = require('node-fetch');
const documents = require('../../data/pmmi/company-dedupe');

const goodIds = [...new Set(documents.map(({ to }) => to))];
const badIds = [...new Set(documents.map(({ from }) => from))];

const { log } = console;
const { BASE4_AUTH_HEADER: Authorization } = process.env;
const type = 'platform/content/company';

const update = async (id, status) => {
  const r = await fetch(`https://pmmi.manage.baseplatform.io/api/2.0rcpi/persistence/platform/content/company/${id}`, {
    method: 'patch',
    body: JSON.stringify({ data: { id, type, status } }),
    headers: {
      'Content-Type': 'application/json',
      Authorization,
    },
  });
  if (!r.ok) {
    const body = await r.json();
    log(body);
    throw new Error(`${r.status}: ${r.statusText}`);
  }
  return r;
};

const draftPublish = async (id) => {
  log(`Republishing ${id}...`);
  await update(id, 2);
  await update(id, 1);
};

const draftDelete = async (id) => {
  log(`Redeleting ${id}...`);
  await update(id, 2);
  await update(id, 0);
};

const execute = async () => {
  log({
    good: goodIds.length,
    bad: badIds.length,
  });
  for (let i = 0; i < goodIds.length; i += 1) {
    const id = goodIds[i];
    await draftPublish(id);
  }
  for (let i = 0; i < badIds.length; i += 1) {
    const id = badIds[i];
    await draftDelete(id);
  }
};

execute();
