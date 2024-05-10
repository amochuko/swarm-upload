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

async function main() {
  if (args.length > 0 && args[0] == "--help") {
    console.log("\nSwarm upload");
    console.log(
      `\nThis cli lets you upload a file to the Swarm Network via the file's URL or a path to a file containing a list of such URLs\n`
    );

    console.log("Flags: ");
    console.log(
      `--url                   A single URL or path to a file containing a list of URLs`
    );
    console.log(`--bee-node-url          The URL of a Bee node to use`);
    console.log(
      `--stamp-batch-id        The ID of the stamp batch to use on the Bee nod`
    );

    console.log("\nExample usage:");
    console.log(
      `\nswarm-upload  --url <note.txt | url to file> --bee-node-url <http://127.0.0.1:1633> --stamp-batch-id <2fb4e183e5d8e1b956d28bbba88842ba913948c4f8bb0f04127a0c94b7f850fe>\n`
    );
  } else {
    console.log(`\nUsage: swarm-upload --help to learn more.\n`);
  }

  const stampBatchIdIndex = args.findIndex(
    (args) => args === "--stamp-batch-id"
  );
  const urlIndex = args.findIndex((args) => args === "--url");
  const beeNodeIndex = args.findIndex((args) => args === "--bee-node-url");

  const url = urlIndex !== -1 ? args[urlIndex + 1] : null;
  const beeNode = beeNodeIndex !== -1 ? args[beeNodeIndex + 1] : null;
  const stampBatchId =
    stampBatchIdIndex !== -1 ? args[stampBatchIdIndex + 1] : null;

  if (!url || !beeNode || !stampBatchId) {
    process.exit();
  }

  try {
    const urls = await parseUrlFlag(url);
    await fetchAndUploadToSwarm(urls, beeNode, stampBatchId);
  } catch (err) {
    console.error(`URLs parsing failed with error: ${err.message}`);
  }
}

main();
