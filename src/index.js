#!/usr/bin/env node

const { parseUrlFlag, fetchAndUploadToSwarm } = require("./utils");

const args = process.argv.slice(2);

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
