#!/usr/bin/env node

// @ts-nocheck

const fs = require("fs");
const https = require("https");
const path = require("path");
const stream = require("node:stream");
const fsPromise = require("fs/promises");
const streamPromise = require("stream/promises");
const { Bee, BeeDebug } = require("@ethersphere/bee-js");
const axios = require("axios");

const args = process.argv.slice(2);

// Validate the URL
function isValidURL(url) {
  const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/;
  return urlRegex.test(url);
}

async function parseUrlFlag(flagPath) {
  if (isValidURL(flagPath)) {
    return [flagPath];
  }

  const sourceFilePath = path.join(__dirname, flagPath);
  let data;

  return await new Promise((resolve, reject) => {
    // Check if the file exists in the current directory.
    fs.access(sourceFilePath, (err) => {
      if (err) {
        console.error(`\nThe file at ${sourceFilePath} does not exist.\n`);
        resolve(false);
      } else {
        fs.readFile(sourceFilePath, { encoding: "utf-8" }, (err_, res) => {
          if (!err_) {
            data = res.trim().split(/\n/);
          }
          resolve(data);
        });
      }
    });
  });
}



main();
