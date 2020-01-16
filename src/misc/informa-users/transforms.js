const { client } = require('@base-cms/micro');
const { get } = require('@base-cms/object-path');

const { log } = console;
const locale = client.json({ url: 'http://host.docker.internal:12009' });
const localeCache = {};

const countryCodes = {
  'Cote D Ivoire': 'CI',
  'Federated States of Micronesia': 'FM',
  'Guinea Bissau': 'GW',
  'Holy See (Vatican City)': 'VA',
  Iran: 'IR',
  Laos: 'LA',
  Macau: 'MO',
  Macedonia: 'MK',
  Moldova: 'MD',
  Palestine: 'PS',
  'South Georgia': 'GS',
  'St. Lucia': 'LC',
  'St. Pierre and Miquelon': 'PM',
  Tanzania: 'TZ',
  'The Gambia': 'GM',
  'United States': 'US',
  'Ascension Island': 'SH',
  Korea: 'KR',
  Zaire: 'CD',
  'Netherlands Antilles': 'SX',
  'Virgin Islands': 'VI',
  'Western Samoa': 'WS',
  Yugoslavia: 'RS',
};

const getCountryCode = (v) => {
  if (countryCodes[v]) return countryCodes[v];
  return v;
};


const getCountryData = async (v) => {
  const code = getCountryCode(v);
  if (get(localeCache, code)) return get(localeCache, code);
  let r = await locale.request('country.asObject', { code });
  if (!r) {
    const rx = await locale.request('country.getCode', { name: code });
    if (rx) r = await locale.request('country.asObject', { code: rx });
  }
  const payload = { countryCode: get(r, 'code'), countryName: get(r, 'name') };
  localeCache[code] = payload;
  if (!r) log(`\n❗  Invalid country "${code}"!\n`);
  return payload;
};

const stripLines = (value) => {
  if (!value) return undefined;
  const v = String(value);
  return v.replace(/[\r\n]/g, ' ').replace(/\s\s+/g, ' ');
};

const formatEmail = (doc) => {
  const email = get(doc, 'mail').toLowerCase().trim();
  const domain = email.substr(email.lastIndexOf('@') + 1);
  return { email, domain };
};

const getField = (doc, fields = []) => fields.reduce((str, k) => {
  if (str) return str;
  // log({ str, k, v: get(doc, k) });
  return stripLines(get(doc, k));
}, undefined);

const formatNames = (doc) => {
  const name = `${get(doc, 'name_line', get(doc, 'name', ''))}`;
  const givenName = getField(doc, ['first_name', 'firstname', 'profile_fname']) || name.includes(' ') ? name.split(' ', 2)[0] : undefined;
  const familyName = getField(doc, ['last_name', 'lastname', 'profile_lname']) || name.includes(' ') ? name.split(' ', 2)[1] : undefined;
  return { givenName, familyName };
};

const formatOrganization = (doc) => getField(doc, ['organisation_name', 'profile_company']);

const formatOrganizationTitle = (doc) => getField(doc, [
  'field_penton_primary_job_role.und.0.value',
  'field_penton_secondary_job_role.und.0.value',
  'field_penton_job_title.und.0.value',
  'profile_job_function',
  'profile_primary_role',
  'profile_secondary_role',
]);

const formatCountry = async (doc) => {
  const country = getField(doc, ['country', 'profile_country', 'pup_country']);
  if (!country) return {};
  const { countryCode, countryName } = await getCountryData(country);
  return { countryCode, countryName };
};

const formatDate = (timestamp = undefined) => {
  if (!timestamp) return undefined;
  return new Date(timestamp * 1000);
};

module.exports = {
  formatEmail,
  formatNames,
  formatCountry,
  formatDate,
  formatOrganization,
  formatOrganizationTitle,
};
