require('dotenv').config();
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const runner = require('./runner');

const { log } = console;

const loadScripts = (dir) => (fs.statSync(dir).isDirectory()
  ? Array.prototype.concat(...fs.readdirSync(dir).map((f) => loadScripts(path.join(dir, f))))
  : dir);

const questions = [
  {
    type: 'list',
    name: 'script',
    message: 'Select script',
    choices: loadScripts('./scripts'),
  },
  {
    type: 'confirm',
    name: 'debug',
    message: 'Enable debugging',
    default: true,
  },
  {
    type: 'confirm',
    name: 'write',
    message: 'Execute writes',
    default: false,
  },
];


const getInput = () => {
  try {
    // eslint-disable-next-line global-require,import/no-unresolved
    return require('../input.json');
  } catch (e) {
    log('Unable to read /input.json file, asking interactively');
    return inquirer.prompt(questions);
  }
};

const run = async () => {
  const { script, debug, write } = await getInput();
  const fn = require(`../${script}`); // eslint-disable-line import/no-dynamic-require,global-require
  await runner(fn, write, debug);
};

log('> Booting script selector...');
run().catch((e) => setImmediate(() => { throw e; }));
