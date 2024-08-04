# Swarm Upload

## Project Overview

This cli app lets you upload a file to the Swarm Network via the file's URL or a path to a file containing a list of such URLs

The app uploads the file(s) located at the URL(s) to the Swarm network in a streaming way without pinning or saving the file(s) locally.

NB: If a file is intended to contain the list(s) of URL to the file on a remote server; then the file most have a [dot]txt extension.

An example of such a file titled [`sample-urls.txt`](./sample-urls.txt) can be found in the root of this project.

## Usage

### Install dependencies

```bash
npm install
```

### Start the CLI App

```bash
npm start
```

## Flag options

    Flags:
        --url                   A single URL or path to a file containing a list of URLs
        --bee-node-url          The URL of a Bee node to use 
        --stamp-batch-id        The ID of the stamp batch to use on the Bee nod
    

    Example usage:
     
    swarm-upload  --file-path <replace-with-your-file-path | url-to-file | filepath-containing-list-of-url(s)> --filename <replace-with-your-filename> --bee-node-url <replace-with-your-bee-node-urll> --stamp-batch-id <replace-with-your-stamp-batch-id>
