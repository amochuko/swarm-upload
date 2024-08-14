const path = require("path");
const fs = require("fs").promises;
const fsAsync = require("node:fs");

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

  return readFileFromFilePath(normalizePath);
}

/**
 * This function reads the file using the filePath
 * @param {*} filePath The location of the file
 */
async function readFileFromFilePath(filePath) {
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

function getUploadOptions(args, fileProps) {
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

  // update UploadOptions
  const uploadOpts = {};
  for (let key in opts) {
    if (opts[key]) {
      uploadOpts[key] = opts[key];
    }
    if (opts[key] && key == "size") {
      uploadOpts[key] = fileProps.size;
    }
    if (opts[key] && key == "contentType") {
      uploadOpts[key] = fileProps.contentType;
    }
    if (opts[key] && key == "redundancyLevel") {
      uploadOpts[key] = opts[key];
    }
  }

  return uploadOpts;
}

const baseDir = path.join(process.cwd(), "swarm_upload_logs");

const pathToLogFile = (filename) => {
  return path.join(baseDir, `${filename}-${new Date().toISOString()}.txt`);
};

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
  getFileName,
  logger,
  pathToLogFile,
  baseDir,
  parseFilePath,
  getFileExtension,
  fileTypeIsNotDotTxt,
  isValidURL,
  getUploadOptions,
  showDownloadingProgress,
};
