const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { Bee, BeeDebug } = require("@ethersphere/bee-js");

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
async function parseUrlFlag(filePath) {
  if (isValidURL(filePath)) {
    return [filePath];
  }

  let fetchedFile;

  // Check if the path is absolute
  if (path.isAbsolute(filePath)) {
    fetchedFile = await fetchFile(filePath);
  } else {
    // Assuming the file is in the current directory or a subdirectory
    const absolutePath = path.join(process.cwd(), filePath);
    fetchedFile = await fetchFile(absolutePath);
  }

  return fetchedFile;
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

  for (let i = 0; i < urls.length; i++) {
    try {
      // generate tag
      const tag = await bee.createTag({});
      tagArr.push(tag);

      console.log(`\n===================================================\n`);

      console.log(`\nDownload started from ${urls[i]}...\n`);
      // @ts-ignore
      axios.get(urls[i], { responseType: "stream" }).then(async (res) => {
        console.log(
          `Using stamp batch ID ${stampBatchId} to upload file to Bee node at ${beenNodeURL}\n`
        );

        const uploadResponse = await bee.uploadFile(
          stampBatchId,
          res.data,
          "ada-love-lace",
          {},
          {
            tag: tagArr[i].uid,
            pinning: false,
          }
        );

        if (uploadResponse.reference) {
          console.log(`File uploaded successfully...\n`);
          console.log(`filename: ${uploadResponse.filename}\nreferenceHash: ${
            uploadResponse.reference
          }\ntagUid: ${uploadResponse.tagUid}\ncid: ${uploadResponse.cid()}
              `);
        }
        console.log(`\n===================================================\n`);
      });
    } catch (err) {
      console.error(`\nUpload to Swarm Network failed with: ${err}\n`);
    }
  }
}

/**
 * This function fetches the file
 * @param {*} filePath The location of the file
 */
function fetchFile(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(`File ${filePath} does not exist.`);
    } else {
      fs.readFile(filePath, { encoding: "utf-8" }, (err, res) => {
        if (!err) {
          resolve(res.trim().split(/\n/));
        }
        reject(err);
      });
    }
  });
}

module.exports = {
  isValidURL,
  fetchFile,
  parseUrlFlag,
  fetchAndUploadToSwarm,
};
