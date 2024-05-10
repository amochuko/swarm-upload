# Swarm Upload

This cli app lets you upload a file to the Swarm Network via the file's URL or a path to a file containing a list of such URLs

The app uploads the file(s) located at the URL(s) to the Swarm network in a streaming way without pinning or saving the file(s) locally.

    Flags:
        --url                   A single URL or path to a file containing a list of URLs
        --bee-node-url          The URL of a Bee node to use 
        --stamp-batch-id        The ID of the stamp batch to use on the Bee nod
    

    Example usage:
     
    swarm-upload  --url <your-file.txt | url-to-file> --bee-node-url <your-bee-node-url> --stamp-batch-id <your-stamp-batch-id-here>
