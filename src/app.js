#!/usr/bin/env node

const { parseUrlFlag, fetchAndUploadToSwarm } = require("./utils");

const args = process.argv.slice(2);

async function main() {
  if (process.argv.length === 2 || process.argv[2] === "--help") {
    // Introductory message and usage instructions
    console.log(`
  Swarm Upload

  This CLI lets you upload a file to the Swarm Network via the file's URL or a path 
  to a file containing a list of such URLs.

  Flags:
    --file-url                   A single URL or path to a file containing a list of URLs
    --filename                   A name given to file
    --bee-node-url              The URL of a Bee node to use
    --stamp-batch-id            The ID of the stamp batch to use on the Bee nod

  Usage:

    node app.js --file-url=replace-with-your-file-url --filename=replace-with-your-filename --bee-node-url=replace-with-your-bee-node-url --stamp-batch-id=replace-with-your-bee-node-url
`);
  }

  const urlIndex = args.findIndex((args) => args === "--file-url");
  const filenameIndex = args.findIndex((args) => args === "--filename");
  const beeNodeIndex = args.findIndex((args) => args === "--bee-node-url");
  const stampBatchIdIndex = args.findIndex(
    (args) => args === "--stamp-batch-id"
  );

  const filePath = urlIndex !== -1 ? args[urlIndex + 1] : null;
  const fileName = filenameIndex !== -1 ? args[filenameIndex + 1] : null;
  const beeNodeUrl = beeNodeIndex !== -1 ? args[beeNodeIndex + 1] : null;
  const stampBatchId =
    stampBatchIdIndex !== -1 ? args[stampBatchIdIndex + 1] : null;

  // Validate and set default values if not provided
  if (!filePath) {
    console.error(
      "\nError: File path or location is required. Please provide a filePath using --file-path <replace-with-your-file-url>.\n"
    );
    process.exit(1);
  }
  if (!fileName) {
    console.error(
      "\nError: File name is required. Please provide a filename using --filename <replace-with-your-filename>.\n"
    );
    process.exit(1);
  }
  if (!beeNodeUrl) {
    console.error(
      "\nError: Bee node url is required. Please provide a bee-node-url using --bee-node-url <replace-with-your-bee-node-url>.\n"
    );
    process.exit(1);
  }

  if (!stampBatchId) {
    console.error(
      "\nError: Stamp Batch ID is required. Please provide a stamp Batch ID using --stamp-batch-id=<replace-with-your-bee-node-url>.\n"
    );
    process.exit(1);
  }

  try {
    const urls = await parseUrlFlag(filePath, fileName);
    await fetchAndUploadToSwarm(urls, beeNodeUrl, stampBatchId);
  } catch (err) {
    console.error(err);
    throw new Error(err);
  }
}

module.exports = { main };