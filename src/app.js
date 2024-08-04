const {
  parsePathFlag,
  fetchAndUploadToSwarm,
  isValidURL,
  fileTypeIsNotDotTxt,
} = require("./utils");

const args = process.argv.slice(2);

async function main() {
  if (process.argv.length === 2 || process.argv[2] === "--help") {
    // Introductory message and usage instructions
    console.log(`
  Swarm Upload

  This CLI lets you upload a file to the Swarm Network via the file's URL or a path 
  to a file containing a list of such URLs.

  Flags:

    --file-path                 A single URL or path to a file containing a list of URLs
    --bee-node-url             The URL of a Bee node to use
    --stamp-batch-id           The ID of the stamp batch to use on the Bee nod
  
    Optionals
 
    --encrypt                  Encrypts the uploaded data and return longer hash which also includes the decryption key (eg. --encrypt true)
    --deferred                 Determines if the uploaded data should be sent to the network immediately (eq. --deferred false) or in a deferred fashion (eq. --deferred true)
    --content-type             Specifies given Content-Type so when loaded in browser the file is correctly represented (eg. --content-type true)
    --pin                      Use to pin the data locally in the Bee node as well (eg. --pin true)
    --size                     Specifies Content-Length for the given data. It is required when uploading with Readable (eg. --size true)
    --redundancy-level         It use to ensure the retrieval of data chunk against any level of data loss 
                               (eq. --redundancy-level 1) The value (number) ranges from 0 - 4. NB: The higher the number, the higher the cost that follows it. 

  Usage:

    npm start -- --file-path <replace-with-your-file-path | url-to-file | filepath-containing-list-of-url(s)> --filename <replace-with-your-filename> --bee-node-url <replace-with-your-bee-node-url> --stamp-batch-id <replace-with-your-stamp-batch-id> 
`);
  }

  const filePathIndex = args.findIndex((args) => args === "--file-path");
  const beeNodeIndex = args.findIndex((args) => args === "--bee-node-url");
  const postageBatchIdIndex = args.findIndex(
    (args) => args === "--stamp-batch-id"
  );

  const encryptIndex = args.findIndex((args) => args === "--encrypt");
  const deferredIndex = args.findIndex((args) => args === "--deferred");
  const contentTypeIndex = args.findIndex((args) => args === "--contentType");
  const pinIndex = args.findIndex((args) => args === "--pin");
  const sizeIndex = args.findIndex((args) => args === "--size");
  const redundancyLevelIndex = args.findIndex(
    (args) => args === "--redundancy-level"
  );

  const filePath = filePathIndex !== -1 ? args[filePathIndex + 1] : null;
  const beeNodeURL = beeNodeIndex !== -1 ? args[beeNodeIndex + 1] : null;
  const postageBatchId =
    postageBatchIdIndex !== -1 ? args[postageBatchIdIndex + 1] : null;

  // Options
  const redundancyLevel =
    redundancyLevelIndex !== -1 && args[redundancyLevelIndex + 1];
  const size = sizeIndex !== -1 && args[sizeIndex + 1];
  const encrypt = encryptIndex !== -1 && args[encryptIndex + 1];
  const deferred = deferredIndex !== -1 && args[deferredIndex + 1];
  const pin = pinIndex !== -1 && args[pinIndex + 1];
  const contentType = contentTypeIndex !== -1 && args[contentTypeIndex + 1];

  // Validate and set default values if not provided
  if (!filePath) {
    console.error(
      "\nError: File path or location is required. Please provide a filePath using --file-path <replace-with-your-file-path | url-to-file | filepath-containing-list-of-url(s)>.\n"
    );
    process.exit(1);
  }

  if (fileTypeIsNotDotTxt(filePath) && !isValidURL(filePath)) {
    console.error("\nError: Not a valid URL. Please review the URL.\n");
    process.exit(1);
  }

  if (!beeNodeURL) {
    console.error(
      "\nError: Bee node url is required. Please provide a bee-node-url using --bee-node-url <replace-with-your-bee-node-url>.\n"
    );
    process.exit(1);
  }

  if (!postageBatchId) {
    console.error(
      "\nError: Stamp Batch ID is required. Please provide a stamp Batch ID using --stamp-batch-id <replace-with-your-bee-node-url>.\n"
    );
    process.exit(1);
  }

  try {
    const urls = await parsePathFlag(filePath);

    await fetchAndUploadToSwarm({
      beeNodeURL,
      urls,
      postageBatchId,
      size: Boolean(size),
      pin: Boolean(pin),
      contentType: Boolean(contentType),
      redundancyLevel: Number(redundancyLevel),
      encrypt: Boolean(encrypt),
      deferred: Boolean(deferred),
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

module.exports = { main };
