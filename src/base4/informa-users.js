/* eslint-disable no-await-in-loop */
const fetch = require('node-fetch');
const fs = require('fs');
const CsvReadableStream = require('csv-reader');
const uuidv4 = require('uuid/v4');
const bcrypt = require('bcrypt');
const { createObjectCsvWriter } = require('csv-writer');

const { BASE4_AUTH_HEADER: Authorization } = process.env;
const file = '../data/informa-users-2.csv';

const csvWriter = createObjectCsvWriter({
  path: file,
  header: [
    'firstName',
    'lastName',
    'username',
    'email',
    'plaintext',
    'hash',
  ],
});

const { log } = console;

const urls = [
  'https://manage.americanmachinist.com',
  'https://manage.asumag.com',
  'https://manage.bulktransporter.com',
  'https://manage.contractingbusiness.com',
  'https://manage.contractormag.com',
  'https://manage.ecmweb.com',
  'https://manage.ehstoday.com',
  'https://manage.electricalmarketing.com',
  'https://manage.electronicdesign.com',
  'https://manage.ewweb.com',
  'https://manage.fleetowner.com',
  'https://manage.forgingmagazine.com',
  'https://manage.foundrymag.com',
  'https://manage.hpac.com',
  'https://manage.hydraulicspneumatics.com',
  'https://manage.industryweek.com',
  'https://manage.machinedesign.com',
  'https://manage.mhlnews.com',
  'https://manage.mwrf.com',
  'https://manage.newequipment.com',
  'https://manage.powerelectronics.com',
  'https://manage.refrigeratedtransporter.com',
  'https://manage.rermag.com',
  'https://manage.sourcetoday.com',
  'https://manage.tdworld.com',
  'https://manage.trailer-bodybuilders.com',
  'https://manage.trucker.com',
  'https://manage.truckfleetmro.com',
];

const objectify = (rows = []) => {
  const headers = rows.slice(0, 1).pop();
  log(headers);
  return rows.slice(1).map((row) => ({
    ...(headers[0] && { [headers[0]]: `${row[0]}`.trim() }),
    ...(headers[1] && { [headers[1]]: `${row[1]}`.trim() }),
    ...(headers[2] && { [headers[2]]: `${row[2]}`.trim() }),
    ...(headers[3] && { [headers[3]]: `${row[3]}`.trim() }),
    ...(headers[4] && { [headers[4]]: `${row[4]}`.trim() }),
    ...(headers[5] && { [headers[5]]: `${row[5]}`.trim() }),
  }));
};

const readCsv = () => new Promise((resolve, reject) => {
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

const updateCsv = async () => {
  log('Read data from CSV');
  const data = await readCsv();
  log('Generating passwords');
  for (let i = 0; i < data.length; i += 1) {
    const user = data[i];
    user.plaintext = await uuidv4();
    user.hash = await bcrypt.hash(user.plaintext, 10);
    user.hash = user.hash.replace('$2b$', '$2y$');
  }
  log('Writing data to CSV');
  await csvWriter.writeRecords(data);
  log('Done!');
};

const buildPayload = ({
  email,
  username,
  firstName,
  lastName,
  hash,
}) => ({
  accountNonExpired: true,
  accountNonLocked: true,
  credentialsNonExpired: true,
  enabled: true,
  mustChange: true,
  roles: ['ROLE_EDITOR'],
  type: 'platform/security/user',
  email,
  username,
  firstName,
  lastName,
  password: hash,
});

const createUser = async (url, payload) => {
  log(`creating user ${payload.username} on ${url}`);
  const r = await fetch(`${url}/api/2.0rcpi/persistence/platform/security/user`, {
    method: 'post',
    body: JSON.stringify({ data: payload }),
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

const createUsers = async () => {
  const users = await readCsv();
  const payloads = users.map(buildPayload);
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    for (let u = 0; u < payloads.length; u += 1) {
      const payload = payloads[u];
      await createUser(url, payload);
    }
  }
};

const main = async () => {
  await updateCsv();
  await createUsers();
};

main();
