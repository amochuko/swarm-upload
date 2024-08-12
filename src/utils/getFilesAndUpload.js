const { Bee } = require("@ethersphere/bee-js");
const axios = require("axios");

const {
  getUploadOptions,
  getFileExtension,
  getFileName,
  isValidURL,
  showDownloadingProgress,
} = require("./helpers");

const path = require("path");
const os = require("os");
const fsAsync = require("node:fs");
const fs = require("fs").promises;

/**
 * Function that encapsulate the `bee` upload
 * @param {Object} argsObj - The argument object
 * @param {string} argsObj.beeNodeURL - The Bee Node url
 * @param {string | import("@ethersphere/bee-js").BatchId} argsObj.postageBatchId  - The stamp Id
 * @param {string[]} argsObj.urls urls The location of the file
 * @param {boolean} argsObj.size [size] Specifies Content-Length for the given data. Optional.
 * @param {boolean} argsObj.pin [pin]  Use to pin the data locally in the Bee node as well. Optional.
 * @param {boolean} argsObj.contentType [contentType] Specifies given Content-Type so when loaded in browser the file is correctly represented. Optional.
 * @param {boolean}argsObj.encrypt [encrypt] Encrypts the uploaded data and return longer hash which also includes the decryption key. Optional.
 * @param {boolean}argsObj.deferred [deferred] Determines if the uploaded data should be sent to the network immediately. Optional.
 * @param {number} argsObj.redundancyLevel [redundancyLevel] The level of preserving data
 */
async function getFilesAndUpload(argsObj) {
  const bee = new Bee(argsObj.beeNodeURL);

  try {
    const taskA = argsObj.urls.map(async (url, i) => {
      if (!isValidURL(url)) {
        throw new Error(`Not a valid URL! -> ${url}`);
      }

      // @ts-ignore
      const resp = await axios.get(url, { responseType: "stream" });

      if (resp.status != 200) {
        throw new Error(`Failed to download file No. ${i + 1}`);
      }

      const fileProps = {
        size: parseInt(resp.headers["content-length"], 10),
        extension:
          getFileExtension(url) ||
          `.${resp.headers["content-type"].split("/")[1]}`,
        name: getFileName(String(url)),
        contentType: resp.headers["content-type"],
      };

      let downloadedBytes = 0;

      // Listen to the 'data' event to receive chunks of data
      resp.data.on("data", (chunk) => {
        // Update the number of bytes downloaded
        downloadedBytes += chunk.length;

        showDownloadingProgress(downloadedBytes, fileProps.size, i);
      });

      resp.data.on("error", (err) => {
        throw err;
      });

      const tempFilePath = path.join(
        os.tmpdir(),
        `temp-${fileProps.name}-${Date.now()}${fileProps.extension}`
      );

      // save data to temporary location
      const writer = fsAsync.createWriteStream(tempFilePath);
      resp.data.pipe(writer);

      await new Promise((res, rej) => {
        writer.on("finish", res);
        writer.on("error", rej);
      });

      const readStream = fsAsync.createReadStream(tempFilePath);

      return {
        fileProps,
        tempFilePath,
        readStream,
        resp /** `resp` to stream data directly to Bee Network */,
      };
    });

    const taskAResponse = await Promise.all(taskA);

    const uploadResults = taskAResponse.map(async (t, i) => {
      const filename = `${t.fileProps.name}${t.fileProps.extension}`;

      // update UploadOptions
      const uploadOptions = getUploadOptions(argsObj, t.fileProps);

      const platform = "win32";
      const clearLineAndMoveUp =
        platform === "win32" ? "\x1b[0K\x1b[0G" : "\x1b[0K\r";

      // Write the escape sequence to clear the line and move the cursor up
      process.stdout.write(clearLineAndMoveUp);
      process.stdout.write(`Uploading...`);

      const uploadResp = await bee.uploadFile(
        argsObj.postageBatchId,
        t.readStream,
        filename,
        {
          ...uploadOptions,
        }
      );

      if (uploadResp.reference) {
        await fs.unlink(t.tempFilePath);
      }

      return uploadResp;
    });

    // Execute all tasks in parallel and wait for all of them to complete
    const results = await Promise.all(uploadResults);

    if (results.length) {
      console.log(`\nUploading...`);
    }

    return results; // Return an array of results from all uploads
  } catch (err) {
    throw err;
  }
}

module.exports = { getFilesAndUpload };
