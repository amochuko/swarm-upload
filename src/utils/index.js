const path = require("path");
const fs = require("fs").promises;
const fsAsync = require("node:fs");

const axios = require("axios").default;
const { Bee } = require("@ethersphere/bee-js");
const os = require("os");

const baseDir = path.join(process.cwd(), "swarm_upload_logs");
const pathToLogFile = (filename) =>
  path.join(baseDir, `${filename}-${new Date().toISOString()}.txt`);

// Manually define some common MIME types for file extensions
const mimeTypes = {
  txt: "text/plain",
};

/**
 * Function to extract the extension of a file
 * @param {any} filePath The path to the file
 * @return extension of file
 */
function getFileExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

/**
 * Funtion to get the type of a file
 * @param {string} filePath The path to the file
 * @returns string | unknown
 */
function getFileType(filePath) {
  const ext = getFileExtension(filePath).split(".")[1];
  return mimeTypes[ext] || "unknown";
}

/**
 * Function to ascertain a file extension is `.txt`
 * @param {any} filePath
 * @returns bool
 */
function fileTypeIsNotDotTxt(filePath) {
  const fileType = getFileType(filePath);
  return fileType !== Object.values(mimeTypes)[0];
}

/**
 *  This function normalizes filePath if filePath is local (relative or absolute)
 * @param {string} filePath Path to the file
 * @returns {string} The file path
 */
function normalizeFilePath(filePath) {
  let fPath;

  // Check if the path is absolute
  if (path.isAbsolute(filePath)) {
    fPath = filePath;
  } else {
    // Assuming the file is in the current directory or a subdirectory
    fPath = path.join(process.cwd(), filePath);
  }

  return fPath;
}

/**
 * The function validates the URL
 * @param {string} url path to the file
 * @returns boolean
 */
function isValidURL(url) {
  const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/;
  return urlRegex.test(url);
}

/**
 * This function receives the file path / url and goes ahead
 * to get the file it links to
 * @param {string} url The location of the file
 * @returns file content
 */
async function parseFilePath(url) {
  // if path is a single url to a file
  if (isValidURL(url)) {
    return [url];
  }

  const normalizePath = normalizeFilePath(url);

  const stats = await fs.stat(normalizePath);
  if (!stats.isFile()) {
    throw new Error("File does not exist!");
  }

  if (fileTypeIsNotDotTxt(normalizePath)) {
    return [url];
  }

  return fetchFile(normalizePath);
}

/**
 * This function fetches the file
 * @param {*} filePath The location of the file
 */
async function fetchFile(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, { encoding: "utf-8" });
    return fileContent
      .split(/\n/)
      .map((ln) => ln.trim())
      .filter((ln) => ln !== "");
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    throw err;
  }
}

/**
 * Get filename from a valid URL, or generates one
 * @param {string} url The url to file
 * @returns
 */
function getFileName(url) {
  return path.basename(decodeURIComponent(url))
    ? path.basename(decodeURIComponent(url)).split(".")[0]
    : new Date().toISOString();
}

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

async function fetchAndUploadToSwarm({
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

    console.log("\nUpload was successful. Logging result: \n");
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
  } catch (err) {
    console.error(`\nProcessing failed with ${err}\n`);
  }
}

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

  const uploadOptions = getUploadOptions(argsObj);

  try {
    const taskA = argsObj.urls.map(async (url, i) => {
      if (!isValidURL(url)) {
        throw new Error(`Not a valid URL! -> ${url}`);
      }

      console.log(`Fetching file No. ${i + 1} from ${url}\n`);
      const resp = await axios.get(url, { responseType: "stream" });

      if (resp.status != 200) {
        throw new Error(`Failed to download file No. ${i + 1} from ${url}`);
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
      let percentageComplete = 0;

      // Listen to the 'data' event to receive chunks of data
      resp.data.on("data", (chunk) => {
        // Update the number of bytes downloaded
        downloadedBytes += chunk.length;

        // Calculate the percentage of the download that's complete
        percentageComplete = Math.round(
          (downloadedBytes / fileProps.size) * 100
        );

        // Log the progress to stdout
        console.log(
          `Download progress for file No. ${i + 1}: ${percentageComplete}%`
        );

        if (percentageComplete === 100) {
          console.log(`\nPiping data to stream...\n`);
        }
      });

      resp.data.on("error", (err) => {
        console.error("Error downloading file: ", err);
      });

      const tempFilePath = path.join(
        os.tmpdir(),
        `temp-${fileProps.name}-${Date.now()}${fileProps.extension}`
      );
      if (tempFilePath)
        console.log(`Created temporary file ${i + 1} at ${tempFilePath}\n`);

      // save data to temporary location
      const writer = fsAsync.createWriteStream(tempFilePath);
      resp.data.pipe(writer);

      await new Promise((res, rej) => {
        writer.on("finish", res);
        writer.on("error", rej);
      });

      const readStream = fsAsync.createReadStream(tempFilePath);

      return { fileProps, tempFilePath, readStream };
    });

    const taskAResponse = await Promise.all(taskA);

    const uploadResults = taskAResponse.map(async (t, i) => {
      const filename = `${t.fileProps.name}${t.fileProps.extension}`;

      // update UploadOptions
      const uploadOpts = {};
      for (let key in uploadOptions) {
        if (uploadOptions[key]) {
          uploadOpts[key] = uploadOptions[key];
        }
        if (uploadOptions[key] && key == "size") {
          uploadOpts[key] = t.fileProps.size;
        }
        if (uploadOptions[key] && key == "contentType") {
          uploadOpts[key] = t.fileProps.contentType;
        }
        if (uploadOptions[key] && key == "redundancyLevel") {
          uploadOpts[key] = uploadOptions[key];
        }
      }

      console.log(`Uploading stream No. ${i + 1} to Swarm Node...`);

      const uploadResp = await bee.uploadFile(
        argsObj.postageBatchId,
        t.readStream,
        filename,
        {
          ...uploadOpts,
        }
      );

      if (uploadResp.reference) {
        console.log(
          `\nCleaning up temporary file ${i + 1} at ${t.tempFilePath}`
        );
        await fs.unlink(t.tempFilePath);
      }

      return uploadResp;
    });

    // Execute all tasks in parallel and wait for all of them to complete
    const results = await Promise.all(uploadResults);

    return results; // Return an array of results from all uploads
  } catch (err) {
    console.error(err);
    throw err;
  }
}

function getUploadOptions(args) {
  const opts = {};

  for (let key in args) {
    if (
      args[key] != undefined &&
      key !== "postageBatchId" &&
      key !== "beeNodeURL" &&
      key !== "bee" &&
      key !== "urls"
    ) {
      opts[key] = args[key];
    }
  }

  return opts;
}

/**
 * This function logs the report of a successful upload
 * @param {string} filePath file path to save the output; default path = {pathToLogFile}
 * @param {string} content The content to be written
 */
async function logger(filePath, content, fileIndex) {
  try {
    if (!fsAsync.existsSync(baseDir)) {
      fsAsync.mkdir(baseDir, { recursive: true }, (err) => {});
    }

    await writeContentToFile(filePath, content, fileIndex);
  } catch (err) {
    console.error(err);
  }
}

/**
 * Function that writes to file
 * @param {string | fs.FileHandle} filePath path to the file
 * @param {string} data The content to be written
 */
async function writeContentToFile(filePath, data, fileIndex) {
  try {
    await fs.writeFile(filePath, data);
    console.log(`\n\nLog ${fileIndex} written to ${filePath}\n`);
  } catch (err) {
    throw err;
  }
}

module.exports = {
  isValidURL,
  parseFilePath,
  fetchAndUploadToSwarm,
  fileTypeIsNotDotTxt,
};
