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
    name: 'multi',
    message: 'Is this script performing "updateMany"s',
    default: false,
  },
  {
    type: 'confirm',
    name: 'write',
    message: 'Execute writes',
    default: false,
  },
];

const run = async () => {
  const {
    script,
    debug,
    write,
    multi,
  } = await inquirer.prompt(questions);
  const fn = require(`../${script}`); // eslint-disable-line import/no-dynamic-require,global-require
  await runner(fn, write, debug, multi);
};

log('> Booting script selector...');
run().catch((e) => setImmediate(() => { throw e; }));
