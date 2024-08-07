# Swarm Upload

## Project Overview

This cli app lets you upload a file to the Swarm Network via the file's URL or a path to a file containing a list of such URLs

The app uploads the file(s) located at the URL(s) to the Swarm network in a streaming way without pinning or saving the file(s) locally.

NB: If a file is intended to contain the list(s) of URL to the file on a remote server; then the file most have a [dot]txt extension.

An example of such a file titled [`sample-urls.txt`](./sample-urls.txt) can be found in the root of this project.

## Usage

### Install dependencies

```bash
npm install --global .
```

### Start the CLI App

```bash
swarm-upload
```

## Flag options

    Flags:

        --url                   A single URL or path to a file containing a list of URLs
        --bee-node-url          The URL of a Bee node to use 
        --stamp-batch-id        The ID of the stamp batch to use on the Bee node

    
    Optionals
 
    --encrypt                  Encrypts the uploaded data and return longer hash which also includes the decryption key (eg. --encrypt true)
    --deferred                 Determines if the uploaded data should be sent to the network immediately (eq. --deferred false) or in a deferred fashion (eq. --deferred true)
    --content-type             Specifies given Content-Type so when loaded in browser the file is correctly represented (eg. --content-type true)
    --pin                      Use to pin the data locally in the Bee node as well (eg. --pin true)
    --size                     Specifies Content-Length for the given data. It is required when uploading with Readable (eg. --size true)
    --redundancy-level         It use to ensure the retrieval of data chunk against any level of data loss 
                               (eq. --redundancy-level 1) The value (number) ranges from 0 - 4. NB: The higher the number, the higher the cost that follows it.
    

    Example usage:

    (When installed)

    swarm-upload  --file-path <replace-with-your-file-path | url-to-file | filepath-containing-list-of-url(s)> --bee-node-url <replace-with-your-bee-node-urll> --stamp-batch-id <replace-with-your-stamp-batch-id>


    (Not yet installed and in project directory)

    NB: Using accompanying sample-urls.txt with a Bee node running locally (but should work with remote Bee node)
    
    1. Supplying path to a text file containing list of file url(s) 
        npm start -- --bee-node-url http://127.0.0.1:1633 --stamp-batch-id a7fff0a82cffd30cc613bc6d569c6344f719cd603a8a04d0aa4c4c621bac775e --file-path ./sample-urls.txt
    
    2. Supplying path to a specific file
        npm start -- --bee-node-url http://127.0.0.1:1633 --stamp-batch-id a7fff0a82cffd30cc613bc6d569c6344f719cd603a8a04d0aa4c4c621bac775e --file-path https://raw.githubusercontent.com/amochuko/zcash-poster-design/main/ywallet_sweep_compressed.mp4
