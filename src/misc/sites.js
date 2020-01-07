const fetch = require('node-fetch');
const { createArrayCsvWriter } = require('csv-writer');

const csvWriter = createArrayCsvWriter({
  path: '../data/sites.csv',
  header: [
    'domain',
    'stack',
    'repository',
    'url',
    'status',
    'version',
    'url',
    'status',
    'version',
    'url',
    'status',
    'version',
    'url',
    'status',
    'version',
  ],
});

const { log } = console;

const domains = [
  'americanmachinist.com',
  'asumag.com',
  'automationworld.com',
  'aviationpros.com',
  'bioopticsworld.com',
  'bizbash.com',
  'broadbandtechreport.com',
  'bulktransporter.com',
  'cablinginstall.com',
  'cannabisequipmentnews.com',
  'citybeat.com',
  'cltampa.com',
  'contractingbusiness.com',
  'contractormag.com',
  'cpapracticeadvisor.com',
  'dentaleconomics.com',
  'dentistryiq.com',
  'designdevelopmenttoday.com',
  'distributedenergy.com',
  'dmnews.com',
  'ecmweb.com',
  'ehstoday.com',
  'electricalmarketing.com',
  'electronicdesign.com',
  'evaluationengineering.com',
  'ewweb.com',
  'firehouse.com',
  'fleetowner.com',
  'flowcontrolnetwork.com',
  'foodlogistics.com',
  'foodmanufacturing.com',
  'forconstructionpros.com',
  'foresternetwork.com',
  'forgingmagazine.com',
  'foundrymag.com',
  'greenindustrypros.com',
  'gxcontractor.com',
  'hcinnovationgroup.com',
  'healthcarepackaging.com',
  'hpac.com',
  'hpnonline.com',
  'hydraulicspneumatics.com',
  'ien.com',
  'impomag.com',
  'inddist.com',
  'industrial-lasers.com',
  'industryweek.com',
  'intelligent-aerospace.com',
  'laserfocusworld.com',
  'ledsmagazine.com',
  'lightwaveonline.com',
  'locksmithledger.com',
  'machinedesign.com',
  'manufacturing.net',
  'masstransitmag.com',
  'mbtmag.com',
  'mhlnews.com',
  'militaryaerospace.com',
  'mlo-online.com',
  'mswmanagement.com',
  'mundopmmi.com',
  'mwrf.com',
  'nashvillepost.com',
  'nashvillescene.com',
  'newequipment.com',
  'nfocusnashville.com',
  'oemmagazine.org',
  'oemoffhighway.com',
  'officer.com',
  'offshore-mag.com',
  'ogj.com',
  'packworld.com',
  'perioimplantadvisory.com',
  'plasticsmachinerymagazine.com',
  'powerelectronics.com',
  'printingnews.com',
  'processingmagazine.com',
  'profoodworld.com',
  'rdhmag.com',
  'refrigeratedtransporter.com',
  'rermag.com',
  'sdcexec.com',
  'securityinfowatch.com',
  'sourcetoday.com',
  'stormh2o.com',
  'strategies-u.com',
  'taxpracticeadvisor.com',
  'tdworld.com',
  'trailer-bodybuilders.com',
  'trucker.com',
  'truckfleetmro.com',
  'utilityproducts.com',
  'vehicleservicepros.com',
  'vendingmarketwatch.com',
  'vision-systems.com',
  'washingtoncitypaper.com',
  'watertechonline.com',
  'waterworld.com',
];

const data = domains.reduce((arr, domain) => {
  const host = domain.slice(0, domain.lastIndexOf('.'));
  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  const checks = {
    'staging-external': `https://staging.${host}.${tld}`,
    'staging-internal': `https://${host}.www.base-cms-staging.io`,
    'production-external': `https://www.${host}.${tld}`,
    'production-internal': `https://${host}.www.base-cms.io`,
  };
  return [...arr, { domain, checks }];
}, []);

const check = async (url) => {
  try {
    const r = await fetch(url, { method: 'head' });
    return { url, status: r.status, version: r.headers.get('x-version') };
  } catch (e) {
    return { url, status: 'FAIL', version: null };
  }
};

const execute = async () => {
  const map = await Promise.all(data.map(async ({ domain, checks }) => {
    const result = {
      domain,
      checks: {
        'staging-external': await check(checks['staging-external']),
        'staging-internal': await check(checks['staging-internal']),
        'production-external': await check(checks['production-external']),
        'production-internal': await check(checks['production-internal']),
      },
    };
    return result;
  }));
  // log(inspect(map, { depth: 3 }));

  const rows = map.map(({ domain, checks }) => {
    const row = [
      domain,
      'stack',
      'repo',
      ...Object.keys(checks).reduce((arr, k) => {
        const cols = Object.keys(checks[k]).map((kv) => checks[k][kv]);
        return [...arr, ...cols];
      }, []),
    ];
    return row;
  });
  await csvWriter.writeRecords(rows);
  log('Done');
};

execute();
