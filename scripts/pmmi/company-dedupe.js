const { log } = console;

const companies = [
  // import from CSV once finalized
  { from: 13322070, to: 13285655 },
  { from: 13324917, to: 13285656 },
  // ...
];

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
  log('Building schedule updates for companies...');
  const schedule = companies.map(({ from, to }) => ({
    filter: { 'content.$id': from },
    $set: { 'content.$id': to },
  }));

  return {
    multi: true,
    updates: {
      content,
      schedule,
    },
  };
};
