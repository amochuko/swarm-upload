const { getFilesAndUpload } = require("./getFilesAndUpload");

const { baseDir, logger, pathToLogFile, getFileName } = require("./helpers");
/**
 * This function uses the urls given it to fetch the pointed file
 * and automatically upload to the Swarm Network
 *
 * @param {Object} argsObj - The argument object
 * @param {string} argsObj.beeNodeURL - The Bee Node url
 * @param {string} argsObj.postageBatchId - The stamp Id
 * @param {string[]} argsObj.urls - The location of the file
 * @param {boolean} argsObj.size [size] - Specifies Content-Length for the given data. Optional.
 * @param {boolean} argsObj.pin [pin] - Use to pin the data locally in the Bee node as well. Optional.
 * @param {boolean} argsObj.contentType [contentType] - Specifies given Content-Type so when loaded in browser the file is correctly represented. Optional.
 * @param {boolean} argsObj.encrypt [encrypt]  - Encrypts the uploaded data and return longer hash which also includes the decryption key. Optional.
 * @param {boolean} argsObj.deferred [deferred]  - Determines if the uploaded data should be sent to the network immediately. Optional.
 * @param {number} argsObj.redundancyLevel [redundancyLevel] -  The level of preserving data
 */

async function getUploadParams({
  urls,
  beeNodeURL,
  postageBatchId,
  size,
  pin,
  contentType,
  redundancyLevel,
  encrypt,
  deferred,
}) {
  try {
    const res = await getFilesAndUpload({
      urls,
      beeNodeURL,
      postageBatchId,
      size,
      contentType,
      redundancyLevel,
      pin,
      encrypt,
      deferred,
    });

    if (res.length > 0) {
      console.log("Upload completed. Logging result: \n");
    }

    res.forEach((r, i) => {
      logger(
        pathToLogFile(getFileName(urls[i])),
        `Filename: ${getFileName(urls[i])}\nReferenceHash: ${
          r.reference
        }\nAccess file: https://gateway.ethswarm.org/access/${
          r.reference
        }\nTagUID: ${r.tagUid}\nCID: ${r.cid()}
                `,
        i + 1
      );

      console.log(
        `\n============================== File ${
          i + 1
        } ==============================`
      );
      console.log(
        `\nFilename: ${getFileName(urls[i])}\nReferenceHash: ${
          r.reference
        }\nAccess file: https://gateway.ethswarm.org/access/${
          r.reference
        }\nTagUID: ${r.tagUid}\nCID: ${r.cid()}
                `
      );
    });

    console.log(`\nLogs are written to ${baseDir}\n`);
  } catch (err) {
    console.error(`\nProcessing failed with ${err}\n`);
  }
}

module.exports = { getUploadParams };
