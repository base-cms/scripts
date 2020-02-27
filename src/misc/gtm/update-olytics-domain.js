const { google } = require('googleapis');
const { eachSeries } = require('@base-cms/async');

const { log } = console;

const sleep = (ms = 30000) => new Promise((resolve) => {
  log(`Pausing for ${ms / 1000} seconds!`);
  setTimeout(resolve, ms);
});

const getAccounts = (gtm) => gtm.accounts.list().then(({ data }) => data.account);

const getContainers = async (gtm, accounts, filter = (v) => v) => {
  const promised = await Promise.all(accounts.map(async ({ path }) => {
    const { data: { container } } = await gtm.accounts.containers.list({ parent: path });
    return container;
  }));
  return promised.reduce((arr, res) => ([...arr, ...res])).filter(filter);
};

const getOrCreateWorkspace = async (gtm, container, name = 'base-cms-gtm-tools') => {
  const { data: { workspace: workspaces } } = await gtm.accounts.containers.workspaces
    .list({ parent: container.path });
  const found = workspaces.filter((workspace) => workspace.name === name);
  if (found.length) return found.pop();
  const { data: workspace } = await gtm.accounts.containers.workspaces.create({
    parent: container.path,
    requestBody: { name },
  });
  return workspace;
};

const getOrCreateWorkspaceTag = async (gtm, workspace, name, payload = {}) => {
  const { data: { tag: tags } } = await gtm.accounts.containers.workspaces.tags
    .list({ parent: workspace.path });
  const found = tags ? tags.filter((tag) => tag.name === name) : [];
  if (found.length) return found.pop();
  const { data: tag } = await gtm.accounts.containers.workspaces.tags.create({
    parent: workspace.path,
    requestBody: { ...payload },
  });
  return tag;
};

const updateTag = async (gtm, tag, payload) => {
  const { data } = await gtm.accounts.containers.workspaces.tags
    .update({
      path: tag.path,
      requestBody: { ...payload },
    });
  return data;
};


const createWorkspaceVersion = async (gtm, workspace, payload) => {
  const { data } = await gtm.accounts.containers.workspaces
    .create_version({
      path: workspace.path,
      requestBody: { ...payload },
    });
  return data.containerVersion;
};

const publishVersion = async (gtm, version) => {
  const { data } = await gtm.accounts.containers.versions.publish({
    path: version.path,
  });
  return data;
};

// const createWorkspaceVersion = async (gtm, workspace, payload) => new Promise((res, reject) => {
//   gtm.accounts.containers.workspaces
//     .create_version({
//       path: workspace.path,
//       requestBody: { ...payload },
//     }, (err, data) => {
//       log(err, data);
//       if (err) {
//         reject(err);
//       }
//       res(data);
//     });
// });

const updateOlyticsDomain = async (gtm, container) => {
  const workspace = await getOrCreateWorkspace(gtm, container, 'gtm-tools-olytics');
  // log(workspace);

  const payload = {
    name: 'Legacy Sapience Init',
    type: 'html',
    parameter: [
      {
        type: 'template',
        key: 'html',
        value: '<script src="https://olytics.as3.io/sapience.js"></script>\n<script>\n  (function() {\n    if (!Sapience) return; \n    Sapience.setDebug(false);\n    Sapience.Config\n      .setApp(\'website\')\n      .setEndpoint({{Legacy Sapience Endpoint}})\n      .setCookieName(\'__web_identity\')\n      .setTrackerDomain(\'https://olytics.as3.io\');\n  })();\n</script>',
      },
      {
        type: 'boolean',
        key: 'supportDocumentWrite',
        value: 'false',
      },
    ],
    tagFiringOption: 'oncePerEvent',
    firingTriggerId: ['2147479553'], // This may not be static.
  };
  const tag = await getOrCreateWorkspaceTag(gtm, workspace, payload.name, payload);

  const params = tag.parameter.filter(({ type, key }) => type === 'template' && key === 'html');
  const html = params[0];
  if (html.value.includes('olytics.cygnus.com')) {
    await updateTag(gtm, tag, payload);
    log(`${container.name}: made changes, publishing workspace!`);
    const version = await createWorkspaceVersion(gtm, workspace, { name: 'Update Olytics domain' });
    await publishVersion(gtm, version);
  } else {
    log(`${container.name}: no changes, deleting workspace!`);
    await gtm.accounts.containers.workspaces.delete({
      path: workspace.path,
    });
  }

  await sleep();
};

const main = async () => {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = './credentials.json';
  const auth = new google.auth.GoogleAuth({
    // Scopes can be specified either as an array or as a single, space-delimited string.
    scopes: [
      'https://www.googleapis.com/auth/tagmanager',
      'https://www.googleapis.com/auth/tagmanager.edit.containers',
      'https://www.googleapis.com/auth/tagmanager.manage.accounts',
      'https://www.googleapis.com/auth/tagmanager.readonly',
      'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
      'https://www.googleapis.com/auth/tagmanager.publish',
      'https://www.googleapis.com/auth/tagmanager.delete.containers',
    ],
  });
  const client = await auth.getClient();
  google.options({ auth: client });

  const gtm = google.tagmanager({ version: 'v2' });

  const accounts = await getAccounts(gtm);
  const containers = await getContainers(gtm, accounts, ({ name }) => name.includes('staging.'));
  containers.sort((a, b) => a.name.localeCompare(b.name));

  const skip = [
    // Informa
    'staging.americanmachinist.com',
    'staging.asumag.com',
    'staging.bulktransporter.com',
    'staging.contractingbusiness.com',
    'staging.contractormag.com',
    'staging.ecmweb.com',
    'staging.ehstoday.com',
    'staging.electricalmarketing.com',
    'staging.electronicdesign.com',
    'staging.ewweb.com',
    'staging.fleetowner.com',
    'staging.forgingmagazine.com',
    'staging.foundrymag.com',
    'staging.hpac.com',
    'staging.hydraulicspneumatics.com',
    'staging.industryweek.com',
    'staging.machinedesign.com',
    'staging.mhlnews.com',
    'staging.mwrf.com',
    'staging.newequipment.com',
    'staging.powerelectronics.com',
    'staging.refrigeratedtransporter.com',
    'staging.rermag.com',
    'staging.sourcetoday.com',
    'staging.tdworld.com',
    'staging.trailer-bodybuilders.com',
    'staging.trucker.com',
    'staging.truckfleetmro.com',

    // Pennwell
    // 'staging.bioopticsworld.com',
    // 'staging.broadbandtechreport.com',
    // 'staging.cablinginstall.com',
    // 'staging.dentaleconomics.com',
    // 'staging.dentistryiq.com',
    // 'staging.distributedenergy.com',
    // 'staging.gxcontractor.com',
    // 'staging.industrial-lasers.com',
    // 'staging.intelligent-aerospace.com',
    // 'staging.laserfocusworld.com',
    // 'staging.ledsmagazine.com',
    // 'staging.lightwaveonline.com',
    // 'staging.militaryaerospace.com',
    // 'staging.offshore-mag.com',
    // 'staging.ogj.com',
    // 'staging.perioimplantadvisory.com',
    // 'staging.rdhmag.com',
    // 'staging.strategies-u.com',
    // 'staging.utilityproducts.com',
    // 'staging.vision-systems.com',
    // 'staging.watertechonline.com',
    // 'staging.waterworld.com',

    // Cygnus, Forester, etc
    // 'staging.aviationpros.com',
    // 'staging.cpapracticeadvisor.com',
    // 'staging.evaluationengineering.com',
    // 'staging.firehouse.com',
    // 'staging.flowcontrolnetwork.com',
    // 'staging.foresternetwork.com',
    // 'staging.hcinnovationgroup.com',
    // 'staging.hpnonline.com',
    // 'staging.locksmithledger.com',
    // 'staging.masstransitmag.com',
    // 'staging.mlo-online.com',
    // 'staging.mswmanagement.com',
    // 'staging.officer.com',
    // 'staging.plasticsmachinerymagazine.com',
    // 'staging.processingmagazine.com',
    // 'staging.securityinfowatch.com',
    // 'staging.stormh2o.com',
    // 'staging.taxpracticeadvisor.com',
    // 'staging.vehicleservicepros.com',
    // 'staging.vendingmarketwatch.com',
  ];
  const toProcess = containers.filter((container) => !skip.includes(container.name));

  await eachSeries(toProcess, async (container) => updateOlyticsDomain(gtm, container));
  log('Complete.');
  process.exit(1);
};

main();


// ogj
// taxpracticeadvisor
