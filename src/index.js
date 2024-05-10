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

async function fetchAndUploadToSwarm(urls, beenNodeURL, stampBatchId) {
  const bee = new Bee(beenNodeURL, {});

  // To hold generated `tag` that is need to keep track of upload status
  const tagArr = [];

  for (let i = 0; i < urls.length; i++) {
    try {
      // generate tag
      const tag = await bee.createTag();
      tagArr.push(tag);

      console.log(`\n===================================================\n`);

      console.log(`\nDownload started from ${urls[i]}...\n`);
      axios.get(urls[i], { responseType: "stream" }).then(async (res) => {
        console.log(
          `Using stamp batch ID ${stampBatchId} to upload file to Bee node at ${beenNodeURL}\n`
        );

        const uploadResponse = await bee.uploadFile(
          stampBatchId,
          res.data,
          "ada-love-lace",
          {},
          {
            tag: tagArr[i].uid,
            pinning: false,
          }
        );

        if (uploadResponse.reference) {
          console.log(`File uploaded successfully...\n`);
          console.log(`filename: ${uploadResponse.filename}\nreferenceHash: ${
            uploadResponse.reference
          }\ntagUid: ${uploadResponse.tagUid}\ncid: ${uploadResponse.cid()}
              `);
        }
        console.log(`\n===================================================\n`);
      });
    } catch (err) {
      console.error(`\nUpload to Swarm Network failed with: ${err}\n`);
    }
  }
}


main();
