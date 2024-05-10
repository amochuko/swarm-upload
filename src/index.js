#!/usr/bin/env node

// @ts-nocheck

const fs = require("fs");
const https = require("https");
const path = require("path");
const stream = require("node:stream");
const fsPromise = require("fs/promises");
const streamPromise = require("stream/promises");
const { Bee, BeeDebug } = require("@ethersphere/bee-js");
const axios = require("axios");

const args = process.argv.slice(2);

// Validate the URL
function isValidURL(url) {
  const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/;
  return urlRegex.test(url);
}


main();
