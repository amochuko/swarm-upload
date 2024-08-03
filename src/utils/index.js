const path = require("path");
const fs = require("fs");
const axios = require("axios").default;
const { Bee } = require("@ethersphere/bee-js");
const os = require("os");

//
const logDirPath = process.cwd() + "/logs";
const pathToLogFile = `swarm-upload-log-${new Date().toISOString()}.txt`;

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
 * @param {string} filePath The location of the file
 * @returns file content
 */
async function parsePathFlag(filePath) {
  // if path is a single url to a file
  if (isValidURL(filePath)) {
    return [{ filePath }];
  }

  const normalizePath = normalizeFilePath(filePath);

  const fileExist = fs.existsSync(normalizePath);
  if (!fileExist) {
    throw new Error("File does not exist!");
  }

  if (fileTypeIsNotDotTxt(normalizePath)) {
    return [{ filePath }];
  }

  return fetchFile(normalizePath);
}

/**
 * This function fetches the file
 * @param {*} filePath The location of the file
 */
function fetchFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, { encoding: "utf-8" });
    return fileContent.split(/\n/);
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
 * @param {string[] | any[]} urls The location of the file
 * @param {string} beeNodeURL The Bee Node url
 * @param {string} postageBatchId The postage stamp id.
 * @param {boolean} [size] Specifies Content-Length for the given data. Optional.
 * @param {boolean} [pin]  Use to pin the data locally in the Bee node as well. Optional.
 * @param {boolean} [encrypt] Encrypts the uploaded data and return longer hash which also includes the decryption key. Optional.
 * @param {boolean} [contentType] Specifies given Content-Type so when loaded in browser the file is correctly represented. Optional.
 * @param {boolean} [deferred] Determines if the uploaded data should be sent to the network immediately. Optional.
 * @param {number} [redundancyLevel] Optional.
 */
async function fetchAndUploadToSwarm(
  urls,
  beeNodeURL,
  postageBatchId,
  size,
  pin,
  contentType,
  redundancyLevel,
  encrypt,
  deferred
) {
  const bee = new Bee(beeNodeURL);

  try {
    const res = await getFilesAndUpload(
      bee,
      urls,
      postageBatchId,
      size,
      contentType,
      redundancyLevel,
      pin,
      encrypt,
      deferred
    );

    res.forEach((r, i) => {
      logger(
        pathToLogFile,
        `Filename: ${getFileName(urls[i])}\nReferenceHash: ${
          r.reference
        }\nAccess file: https://gateway.ethswarm.org/access/${
          r.reference
        }\nTagUID: ${r.tagUid}\nCID: ${r.cid()}
                `
      );
    });
  } catch (err) {
    console.error(`\nUpload to Swarm Network failed: ${err}\n`);
  }
}

/**
 * Function that encapsulate the `bee` upload
 * @param {Bee} bee A active Bee node
 * @param {string | import("@ethersphere/bee-js").BatchId} postageBatchId The stamp Id
 * @param {string[] } urls The location of the file
 * @param {boolean} [size] Specifies Content-Length for the given data. Optional.
 * @param {boolean} [pin]  Use to pin the data locally in the Bee node as well. Optional.
 * @param {boolean} [contentType] Specifies given Content-Type so when loaded in browser the file is correctly represented. Optional.
 * @param {boolean} [encrypt] Encrypts the uploaded data and return longer hash which also includes the decryption key. Optional.
 * @param {boolean} [deferred] Determines if the uploaded data should be sent to the network immediately. Optional.
 * @param {number} [redundancyLevel]
 */
async function getFilesAndUpload(
  bee,
  urls,
  postageBatchId,
  size,
  contentType,
  redundancyLevel,
  pin,
  encrypt,
  deferred
) {
  try {
    const taskA = urls.map(async (url, i) => {
      url = url.trim();
      if (!isValidURL(url)) {
        throw new Error(`Not a valid URL! -> ${url}`);
      }

      console.log(`Fetching file No. ${i + 1} from ${url}`);
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

      let tempFilePath = path.join(
        os.tmpdir(),
        `temp-${fileProps.name}-${Date.now()}${fileProps.extension}`
      );
      if (tempFilePath)
        console.log(`Created temporary file at ${tempFilePath}\n`);

      console.log(`Creating stream No. ${i + 1}...`);
      // save data to temporary location
      let writer = fs.createWriteStream(tempFilePath);
      resp.data.pipe(writer);

      await new Promise((res, rej) => {
        writer.on("finish", res);
        writer.on("error", rej);
      });

      const readStream = fs.createReadStream(tempFilePath);
      return { fileProps, tempFilePath, readStream };
    });

    const taskAResponse = await Promise.all(taskA);
    const uploadResults = taskAResponse.map(async (t, i) => {
      const filename = `${t.fileProps.name}${t.fileProps.extension}`;

      console.log(`Uploading stream No. ${i + 1}...\n`);
      let uploadResp = await bee.uploadFile(
        postageBatchId,
        t.readStream,
        filename
        // {
        //   size: size ? t.fileProps.size : undefined,
        //   contentType: contentType && t.fileProps.contentType,
        //   encrypt,
        //   pin,
        //   redundancyLevel,
        //   deferred,
        // }
      );

      if (uploadResp.reference) {
        console.log("Cleaning up temporary file...\n");
        fs.unlinkSync(t.tempFilePath);
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

/**
 * This function logs the report of a successful upload
 * @param {fs.PathOrFileDescriptor} filePath file path to save the output; default path = {pathToLogFile}
 * @param {string} content The content to be written
 */
function logger(filePath = pathToLogFile, content) {
  // TODO: Review with Async options
  if (!fs.existsSync(logDirPath)) {
    fs.mkdir(logDirPath, {}, (err) => {
      if (err) {
        throw Error(err.message);
      }

      writeContentToFile(process.cwd() + "/logs/" + pathToLogFile, content);
    });
  } else {
    writeContentToFile(process.cwd() + "/logs/" + pathToLogFile, content);
  }
}

/**
 * Function that writes to file
 * @param {string | fs.PathLike} filePath path to the file
 * @param {string} data The content to be written
 */
function writeContentToFile(filePath, data) {
  try {
    const fd = fs.openSync(filePath, "w"); // Open the file for writing
    const buffer = Buffer.from(data); // Convert the data to a buffer
    fs.writeSync(fd, buffer, 0, buffer.length, null); // Write the buffer to the file
    fs.closeSync(fd); // Close the file descriptor
  } catch (err) {
    console.error(`Error writing file: ${err}`);
    throw err;
  }
}

module.exports = {
  isValidURL,
  parsePathFlag,
  fetchAndUploadToSwarm,
  fileTypeIsNotDotTxt,
};
