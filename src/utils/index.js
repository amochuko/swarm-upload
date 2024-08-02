const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { Bee } = require("@ethersphere/bee-js");
const os = require("os");

const logDirPath = process.cwd() + "/logs";
const pathToLogFile = `swarm-upload-log-${new Date().toISOString()}.txt`;

// Manually define some common MIME types for file extensions
const mimeTypes = {
  txt: "text/plain",
};

/**
 * Function to extract the extension of a file
 * @param {any} filePath The path to the file
 */
function getFileExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

/** Funtion to get the type of a file
 * @param {any} filePath The path to the file
 */
function getFileType(filePath) {
  // Check for and return file extionsion
  const ext = getFileExtension(filePath).split(".")[1];
  return mimeTypes[ext] || "unknown";
}

/** Function to ascertain a file extension is `.txt`
 * @param {any} filePath
 * @returns bool
 */
function fileTypeIsNotDotTxt(filePath) {
  // Check file type
  const fileType = getFileType(filePath);

  // Check if file type is `.txt`
  return fileType !== Object.values(mimeTypes)[0];
}

/**
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
 * @param {*} url path to the file
 * @returns boolean
 */
function isValidURL(url) {
  const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/;
  return urlRegex.test(url);
}

/**
 * This function receives the file path / url and goes ahead
 * to get the file it links to
 * @param {*} filePath The location of the file
 * @param {*} fileName The optional name of file
 * @returns file content
 */
async function parsePathFlag(filePath, fileName) {
  // if path is a single url to a file
  if (isValidURL(filePath)) {
    return [{ filePath }];
  }

  // Normalize FilePath if filePath is local (relative or absolute)
  const normalizePath = normalizeFilePath(filePath);

  // Check if file exists
  const fileExist = fs.existsSync(normalizePath);
  if (!fileExist) {
    throw new Error("File does not exist!");
  }

  // Check if file type is not `.txt`
  if (fileTypeIsNotDotTxt(normalizePath)) {
    return [{ filePath }];
  }

  return fetchFile(normalizePath);
}

/**
 * This function uses the urls given it to fetch the
 * pointed file and automatically upload to the Swarm Network
 * @param {string[] | any[]} urls The location of the file
 * @param {string} beenNodeURL The Bee Node url
 * @param {string} postageBatchId The postage stamp id
 * @param {boolean} trackProgress A boolean to enable tracking of upload state
 */
async function fetchAndUploadToSwarm(
  urls,
  beenNodeURL,
  postageBatchId,
  trackProgress
) {
  const bee = new Bee(beenNodeURL);

  // To hold generated `tag` that is need to keep track of upload status
  const tagArr = [];
  try {
    // generate tag for which is meant for tracking progres of syncing data across network.
    // if (trackProgress) {
    //   const tag = await bee.createTag();
    //   console.log("tag here: ", tag);
    //   tagArr.push(tag);
    // }

    const uploadPromises = urls.map(async (url, i) => {
      const trimmedUrl = url.trim();

      if (!isValidURL(trimmedUrl)) {
        throw new Error("Not a valid URL!");
      }

      console.log(
        `\nProcessing started for file No. ${
          urls.indexOf(trimmedUrl) + 1
        } from ${trimmedUrl}`
      );

      // simulate a delay
      await new Promise((res) => setTimeout(res, 1000));

      const uploadResponse = await getFilesAndUpload(
        bee,
        postageBatchId,
        trimmedUrl,
        trackProgress ? tagArr[i].uid : undefined
      );

      return uploadResponse;
    });

    // awaiting Promise to resolve
    const resolvedPromises = await Promise.all(uploadPromises);

    // process resolvedPromises
    resolvedPromises.forEach((res, i) => {
      console.log(
        `File uploaded successfully; logging result to file at ${logDirPath}/${pathToLogFile}\n`
      );

      if (res?.reference) {
        logger(
          pathToLogFile,
          `Filename: ${getFileName(urls[i])}\nReferenceHash: ${
            res.reference
          }\nAccess file: https://gateway.ethswarm.org/access/${
            res.reference
          }\nTagUID: ${res.tagUid}\nCID: ${res.cid()}
              `
        );
      }
    });
  } catch (err) {
    console.error(`\nUpload to Swarm Network failed: ${err}\n`);
  }
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

function getFileName(url) {
  return path.basename(decodeURIComponent(String(url)))
    ? path.basename(decodeURIComponent(String(url))).split(".")[0]
    : new Date().toISOString();
}

/**
 * Function that encapsulate the `bee` upload
 * @param {Bee} [bee] A active Bee node
 * @param {string | import("@ethersphere/bee-js").BatchId} [postageBatchId] The stamp Id
 * @param {string} [url] Path to a file
 * @param {number | undefined} [tag] A generated Bee tag that can be used to track upload progress
 */
async function getFilesAndUpload(bee, postageBatchId, url, tag) {
  try {
    // Generate a unique temporary file name
    const tempFilePath = path.join(os.tmpdir(), `temp-${Date.now()}.${"ext"}`);

    // Download the file to the temporary location
    // @ts-ignore
    const resp = await axios({
      method: "GET",
      url,
      responseType: "stream",
    });

    const fileProps = {
      contentType: resp.headers["content-type"],
      extension: getFileExtension(url)
        ? getFileExtension(url)
        : `.${resp.headers["content-type"].split("/")[1]}`,
      name: getFileName(url),
    };

    // Save the file to the temporary location
    const writer = fs.createWriteStream(tempFilePath);
    resp.data.pipe(writer);

    await new Promise((res, rej) => {
      writer.on("finish", res);
      writer.on("error", rej);
    });

    // read temporary saved file
    const readStream = fs.createReadStream(tempFilePath);
    let uploadResp;

    if (bee && postageBatchId) {
      uploadResp = await bee.uploadFile(
        postageBatchId,
        readStream,
        `${fileProps.name}${fileProps.extension}`
        //     {
        //       // tag,
        //       // encrypt,
        //       // deferred,
        //       // contentType,
        //       // pin,
        //       // size,
        //       // redundancyLevel
        //     }
      );
    }

    // clean up temporary filter:
    fs.unlinkSync(tempFilePath);

    return uploadResp;
  } catch (err) {
    throw err;
  }
}

/**
 * This function logs the report of a successful upload
 * @param {fs.PathOrFileDescriptor | undefined } filePath file path to save the output; default path = "./logs/swarm-upload-result-[timestamp].txt"
 * @param {string} content The content to be written
 */
function logger(filePath = pathToLogFile, content) {
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
