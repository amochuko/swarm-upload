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
      let percentageComplete = 0;

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
          ...uploadOpts,
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

function showDownloadingProgress(received, total, index) {
  const platform = "win32"; // For Windows systems, use win32; otherwise, leave it empty
  let percentage = ((received * 100) / total).toFixed(2);

  // Define the escape sequence to clear the line and move
  // the cursor to the beginning of the next line
  const clearLineAndMoveUp =
    platform === "win32" ? "\x1b[0K\x1b[0G" : "\x1b[0K\r";

  // Write the escape sequence to clear the line and move the cursor up
  process.stdout.write(clearLineAndMoveUp);
  process.stdout.write(
    `Download progress - File ${index + 1}: ${percentage}%.`
  );

  if (+percentage == 100) {
    console.log(``);
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
