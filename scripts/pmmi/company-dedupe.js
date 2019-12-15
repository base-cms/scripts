const companies = require('../../data/pmmi/company-dedupe');

const { log } = console;

module.exports = async () => {
  log('Building content updates for companies...');
  const content = companies.reduce((arr, { from, to }) => {
    const ops = [];

    // Update direct refs
    ops.push({
      filter: { company: from },
      $set: { company: to },
    });

    // Update `relatedTo` refs
    // @todo this might need to be two updates
    ops.push({
      filter: { 'relatedTo.$id': from },
      $addToSet: {
        relatedTo: {
          $ref: 'Content',
          $id: to,
          $db: 'pmmi_all_platform',
          type: 'Company',
        },
      },
    });
    ops.push({
      filter: { 'relatedTo.$id': from },
      $pull: { relatedTo: { $id: from } },
    });

    // ... @todo verify this is everything

    // Delete the company
    ops.push({
      filter: { _id: from },
      $set: { status: 0 },
    });

    return ops.length ? [...arr, ...ops] : arr;
  }, []);

  // Update all schedules to point to the new company
  // @todo what happens if the schedule already exists? will the entire bulk op fail?
  // log('Building schedule updates for companies...');
  const schedule = companies.map(({ from, to }) => ({
    filter: { 'content.$id': from },
    $set: { 'content.$id': to },
  }));

  log('Building redirect updates for companies...');
  const redirect = companies.map(({ from, to }) => ({
    filter: { to: new RegExp(`.*/${from}/.*`, 'ig') },
    $set: { to: `/${to}` },
  }));

  return {
    multi: true,
    updates: {
      // content,
      schedule,
      // redirect,
    },
  };
};
