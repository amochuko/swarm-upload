const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { Bee, BeeDebug } = require("@ethersphere/bee-js");

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
async function parseUrlFlag(filePath, fileName) {
  if (isValidURL(filePath)) {
    return [{ filePath, fileName }];
  }

  // let fetchedFile;

  // // Check if the path is absolute
  // if (path.isAbsolute(filePath)) {
  //   fetchedFile =  fetchFile(filePath);
  // } else {
  //   // Assuming the file is in the current directory or a subdirectory
  //   const absolutePath = path.join(process.cwd(), filePath);
  //   fetchedFile = fetchFile(absolutePath);
  // }

  // return fetchedFile;
  return fetchFile(normalizeFilePath(filePath), fileName);
}

/**
 * This function uses the urls given it to fetch the
 * pointed file and automatically upload to the Swarm Network
 * @param {*} urls The location of the file
 * @param {*} beenNodeURL The Bee Node url
 * @param {*} stampBatchId The postage stamp id
 */
async function fetchAndUploadToSwarm(urls, beenNodeURL, stampBatchId) {
  const bee = new Bee(beenNodeURL, {});

  // To hold generated `tag` that is need to keep track of upload status
  const tagArr = [];

  const parsedUrls = splitPath(urls);

  for (let i = 0; i < parsedUrls.length; i++) {
    try {
      // generate tag for which is meant for tracking progres of syncing data across network.
      const tag = await bee.createTag({});
      tagArr.push(tag);

      console.log(`\n#####\n`);
      console.log(`\nDownload started from ${parsedUrls[i].filePath}...\n`);
      console.log(
        `Using stamp batch ID ${stampBatchId} to upload file to Bee node at ${beenNodeURL}\n`
      );
      console.log(`\n#####\n`);

      let uploadResponse;

      if (isValidURL(parsedUrls[i].filePath)) {
        // @ts-ignore
        const res = await axios.get(parsedUrls[i].filePath, {
          responseType: "arraybuffer",
        });

        uploadResponse = await beeUpload(
          bee,
          stampBatchId,
          res.data,
          parsedUrls[i].filePath,
          parsedUrls[i].fileName,
          tagArr[i].uid
        );
      } else {

        const data = fs.readFileSync(parsedUrls[i].filePath);
        uploadResponse = await beeUpload(
          bee,
          stampBatchId,
          data,
          parsedUrls[i].filePath,
          parsedUrls[i].fileName,
          tagArr[i].uid
        );
      }

      const intervalId = setInterval(() => {
        Array(2)
          .fill("~")
          .forEach((itm) => {
            console.log(itm);
          });
      }, 1000);

      setTimeout(() => {
        if (uploadResponse.reference) {
          console.log(`\nFile uploaded successfully...\n`);
          console.log(`Filename: ${parsedUrls[i].fileName}\nReferenceHash: ${
            uploadResponse.reference
          }\nAccess file: https://gateway.ethswarm.org/access/${
            uploadResponse.reference
          }\nTagUID: ${uploadResponse.tagUid}\nCID: ${uploadResponse.cid()}
                    `);
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
  // Determine if the urlPaths is one item
  if (urlPaths.length === 1) {
    return urlPaths;
  } else {
    return urlPaths.map((path) => {
      const [filePath, fileName] = path.split(" ");
      return { filePath, fileName };
    });
  }
}

/**
 * This function fetches the file
 * @param {*} filePath The location of the file
 */
function fetchFile(filePath, fileName) {
  // Check if file exists
  const fileExist = fs.existsSync(filePath);
  if (!fileExist) {
    throw new Error("File does not exist!");
  }

  // Check if file type is `.txt`
  if (fileTypeIsNotDotTxt(filePath)) {
    // return [filePath + " " + fileName];
    // { filePath: urlPaths[0].url, fileName: urlPaths[0].fileName }
    return [{ filePath, fileName }];
  }

  try {
    const fileContent = fs.readFileSync(filePath, { encoding: "utf-8" });
    const lines = fileContent.trim().split(/\n/);

    return lines;
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
async function beeUpload(
  bee,
  stampBatchId,
  data,
  filePath,
  fileName,
  tag,
  pinning = false
) {
  // @ts-ignore
  return await bee.uploadFile(
    stampBatchId,
    Buffer.from(data),
    `${fileName}${getFileExtension(filePath)}`,
    {},
    { tag, pinning }
  );
}

module.exports = {
  isValidURL,
  fetchFile,
  parseUrlFlag,
  fetchAndUploadToSwarm,
  fileTypeIsNotDotTxt,
};
