import dotenv from "dotenv";
import fs from "fs-extra";
import recursive from "recursive-fs";
import FormData from "form-data";
import basePathConverter from "base-path-converter";
import fetch from 'node-fetch';

try {
    dotenv.config();
} catch(e) {
    console.log('DOTENV ERROR');
    console.log(e);
}

console.log('TEST_ENV', process.env.TEST_ENV);

const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY; 
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID; 
const CLOUDFLATE_HOSTNAME_ID = process.env.CLOUDFLATE_HOSTNAME_ID; 
const PINATA_API_KEY = process.env.PINATA_API_KEY; 
const PINATA_API_SECRET = process.env.PINATA_API_SECRET; 


 console.log(CLOUDFLARE_ZONE_ID);

const PINATA_API_PINFILETOIPFS = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const CLOUDFLARE_API_HOST = "https://api.cloudflare.com/client/v4"

await main();

async function main() {
    const cid = await uploadAssets('./dist');

    await waitForCloudflareIpfs(cid);

    await pointToIpfs(cid);
}


export async function waitForCloudflareIpfs(cid) {
    console.log(`WAITING CID TO BE RESOLVED ON CLOUDFLARE`);

    await fetch(`https://cloudflare-ipfs.com/ipfs/${cid}`);
}

export async function pointToIpfs(cid) {
    const dnslink = `/ipfs/${cid}`;

    console.log(`TRYING TO UPDATE DNSLink to ${dnslink}`);

    console.log('AHAHAHA', CLOUDFLARE_API_KEY);

    const res = await fetch(`${CLOUDFLARE_API_HOST}/zones/${CLOUDFLARE_ZONE_ID}/web3/hostnames/${CLOUDFLATE_HOSTNAME_ID}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
            "Content-Type": 'application/json',
        },
        body: JSON.stringify({
            dnslink,
        })
    });

    const data = await res.json();

    if (data.success) {
        console.log(`DNSLink SUCCESS UPDATED TO ${dnslink}`)
    } else {
        throw new Error(JSON.stringify(data));
    }
}


export async function uploadAssets(folder) {
    const folderPath = folder;

    const { files } = await recursive.read(folderPath);

    console.log('upload files', files);

    if (files?.length <= 0) {
      console.info("No files were found in folder path.");
      return;
    }

    const formData = new FormData();

    files.forEach((filePath) => {
      formData.append("file", fs.createReadStream(filePath), {
        filepath: basePathConverter(folderPath, filePath),
      });
    });

    formData.append(
      "pinataMetadata",
      JSON.stringify({
        name: 'test-site' + Math.floor(Math.random() * 1000000),
      }),
    );

    const data = await fetch(PINATA_API_PINFILETOIPFS, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_API_SECRET,
      },
      body: formData,
    });

    const res = await data.json();

    if (!res.IpfsHash) {
      throw new Error(`cannot receive CID hash: ${JSON.stringify(res)}`)
    }

    console.log(`SUCCESS UPLOADED TO ${res.IpfsHash}`);
    
    return res.IpfsHash;
};
