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

/**
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
 * @returns file content
 */
async function parsePathFlag(filePath, fileName) {
  // if path is a single url to a file
  if (isValidURL(filePath)) {
    return [{ filePath, fileName }];
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
    return [{ filePath, fileName }];
  }

  return fetchFile(normalizePath);
}

/**
 * This function uses the urls given it to fetch the
 * pointed file and automatically upload to the Swarm Network
 * @param {string | any[]} urls The location of the file
 * @param {string} beenNodeURL The Bee Node url
 * @param {string} postageBatchId The postage stamp id
 * @param {boolean} trackProgress A boolean to enable tracking of upload state
 */
async function fetchAndUploadToSwarm(
  urls,
  beenNodeURL,
  postageBatchId,
  trackProgress = false
) {
  const bee = new Bee(beenNodeURL);

  // To hold generated `tag` that is need to keep track of upload status
  const tagArr = [];
  let uploadResponse;

  for (let i = 0; i < urls.length; i++) {
    try {
      // generate tag for which is meant for tracking progres of syncing data across network.
      if (trackProgress) {
        const tag = await bee.createTag();
        console.log("tag here: ", tag);
        tagArr.push(tag);
      }

      console.log(`\n#####\n`);
      console.log(`\nDownload started from ${urls[i].filePath}...\n`);
      console.log(
        `Using stamp batch ID ${postageBatchId} to upload file to Bee node at ${beenNodeURL}\n`
      );
      console.log(`\n#####\n`);

      if (isValidURL(urls[i].filePath)) {
        const fileName = `${urls[i].fileName}${getFileExtension(
          urls[i].filePath
        )}`;

        uploadResponse = await downloadAndUpload(
          bee,
          postageBatchId,
          urls[i].filePath,
          fileName,
          trackProgress ? tagArr[i].uid : undefined
        );
      } else {
        throw Error("Not a valid URL");
      }

      const intervalId = setInterval(() => {
        Array(2)
          .fill("~")
          .forEach((itm) => {
            console.log(itm);
          });
      }, 1000);

      setTimeout(() => {
        if (uploadResponse) {
          console.log(`\nFile uploaded successfully...\n`);
          console.log(`cid: ${uploadResponse.cid}`);

          logToFile(
            pathToLogFile,
            `Filename: ${urls[i].fileName}\nReferenceHash: ${
              uploadResponse.reference
            }\nAccess file: https://gateway.ethswarm.org/access/${
              uploadResponse.reference
            }\nTagUID: ${uploadResponse.tagUid}\nCID: ${uploadResponse.cid()}
            `
          );
          console.log(`\nReport logged to ${logDirPath}/${pathToLogFile}\n`);

          clearInterval(intervalId);
        }
      }, 3000);
    } catch (err) {
      console.error(`\nUpload to Swarm Network failed with: ${err}\n`);
      throw err;
    }
  }
}

/**
 * Function that accepts an array of filePath and fileName in single line
 * If array contains more than one item; it split the line into
 * an object of {filePath:string, fileName:string}
 * @param {any[]} urlPaths
 */
function splitPath(urlPaths) {
  return urlPaths.map((path) => {
    const [filePath, fileName] = path.split(" ");
    return { filePath, fileName };
  });
}

/**
 * This function fetches the file
 * @param {*} filePath The location of the file
 */
function fetchFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, { encoding: "utf-8" });
    const lines = fileContent.trim().split(/\n/);

    return splitPath(lines);
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    throw err;
  }
}

/**
 * Function that encapsulate the `bee` upload
 * @param {Object} [bee] A active Bee node
 * @param {undefined} [stampBatchId] The stamp Id
 * @param {ArrayBuffer | any} [data] An ArrayBuffer
 * @param {undefined} [filePath] Path to a file
 * @param {undefined} [fileName] Name of the file
 * @param {undefined} [tag] A generated Bee tag that can be used to track upload progress
 */
async function beeUploadFile(
  bee,
  stampBatchId,
  data,
  filePath,
  fileName,
  tag,
  pinning = false
) {
  // @ts-ignore

  console.log("stampBatchId: ", stampBatchId);
  console.log("data: ", data);
  console.log("filePath: ", filePath);
  console.log("fileName: ", fileName);

  return await bee.uploadFile(
    stampBatchId,
    data,
    `${fileName}${getFileExtension(filePath)}`,
    {},
    { tag, pinning }
  );
}

/**
 * Function that encapsulate the `bee` upload
 * @param {Bee} [bee] A active Bee node
 * @param {string | import("@ethersphere/bee-js").BatchId} [postageBatchId] The stamp Id
 * @param {string} [fileUrl] Path to a file
 * @param {string | undefined} [fileName] Name of the file
 * @param {number | undefined} [tag] A generated Bee tag that can be used to track upload progress
 */
async function downloadAndUpload(bee, postageBatchId, fileUrl, fileName, tag) {
  try {
    // Generate a unique temporary file name
    const tempFilePath = path.join(os.tmpdir(), `temp-${Date.now()}.${"ext"}`);

    // Download the file to the temporary location
    // @ts-ignore
    const resp = await axios({
      method: "GET",
      url: fileUrl,
      responseType: "stream",
    });

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
      console.log("filename: ", fileName);
      uploadResp = await bee.uploadFile(postageBatchId, readStream, fileName, {
        tag,
        // encrypt,
        // deferred,
        // contentType,
        // pin,
        // size,
        // redundancyLevel
      });
    }

    // clean up temporary filter:
    fs.unlinkSync(tempFilePath);

    return uploadResp;
  } catch (err) {
    console.error(
      "Upload failed:",
      err.response ? err.response.statusText : err.message
    );
  }
}

/**
 * This function logs the report of a successful upload
 * @param {fs.PathOrFileDescriptor | undefined } filePath file path to save the output; default path = "./logs/swarm-upload-result-[timestamp].txt"
 * @param {string} content The content to be written
 */
function logToFile(filePath = pathToLogFile, content) {
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
    const fd = fs.openSync(filePath, "wa"); // Open the file for writing
    const buffer = Buffer.from(data); // Convert the data to a buffer
    fs.writeSync(fd, buffer, 0, buffer.length, null); // Write the buffer to the file
    fs.closeSync(fd); // Close the file descriptor
    console.log("File written successfully");
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
  logToFile,
  pathToLogFile,
};
