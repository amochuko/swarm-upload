// @ts-nocheck
const readline = require('readline');
const fs = require('fs');
const { Bee, BeeDebug } = require('@ethersphere/bee-js');

const bee = new Bee('http://localhost:3054');
const beeDebug = new BeeDebug('http://127.0.0.1:1635');

(async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the URL to POST to: ', (url) => {
    rl.question('Enter the data to POST (JSON format): ', (data) => {
      const jsonData = JSON.parse(data);

      console.log(jsonData);
    });
  });
})();
