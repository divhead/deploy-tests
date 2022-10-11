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

const PINATA_API_KEY = process.env.PINATA_API_KEY; 
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;

const NETIFLY_API_KEY = process.env.NETIFLY_API_KEY;
const NETIFLY_DNS_ZONE_ID = process.env.NETIFLY_DNS_ZONE_ID;

const PINATA_API_PINFILETOIPFS = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const NETIFLY_API_HOST = "https://api.netlify.com/api/v1"

await main();

async function main() {
    const cid = await uploadAssets('./dist');

    await waitForCloudflareIpfs(cid);

    await pointToIpfsNetifly(cid);
}


export async function waitForCloudflareIpfs(cid) {
    console.log(`WAITING CID TO BE RESOLVED ON CLOUDFLARE`);

    let retries = 5;
    let resolved = false;

    while (retries > 0) {
     console.log(`ATTEMPT TO RESOLVE CID, REMAINING RETRIES: ${retries}`);

     await sleep(5000)
      
     const res = await Promise.race([
        fetch(`https://cloudflare-ipfs.com/ipfs/${cid}`),
        sleep(5000)
      ])

      if (res?.ok) {
        resolved = true;
        break;
      } else {
        retries--;
      }
    }

    if (!resolved) {
      throw new Error('Failed to resolve CID on IPFS gateway')
    }
}

export async function pointToIpfsNetifly(cid) {
  const dnslink = `dnslink=/ipfs/${cid}`;

  console.log(`TRYING TO UPDATE DNSLink to ${dnslink}`);

  let oldDnsLinkRecordId;

  {
   console.log('GET OLD DNS RECORD');

    const res = await fetch(`${NETIFLY_API_HOST}/dns_zones/${NETIFLY_DNS_ZONE_ID}/dns_records`, {
      headers: {
        Authorization: `Bearer ${NETIFLY_API_KEY}`,
        "Content-Type": 'application/json',
      }
    })
  
    const data = await res.json();

    oldDnsLinkRecordId = data.find(record => record.type === 'TXT' && record.hostname === '_dnslink.divhead.lol')?.id;

    if (oldDnsLinkRecordId) {
      console.log(`FOUND PREVIOUS DNSLINK ${oldDnsLinkRecordId}`);
    }
  }

  {
    console.log('CREATE NEW DNS RECORD');

    const res = await fetch(`${NETIFLY_API_HOST}/dns_zones/${NETIFLY_DNS_ZONE_ID}/dns_records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NETIFLY_API_KEY}`,
        "Content-Type": 'application/json',
      },
      body: JSON.stringify({
        type: 'TXT',
        hostname: '_dnslink.divhead.lol',
        value: dnslink
      })
    })
  
    const data = await res.json();

    console.log('CREATE NEW DNS RECORD RESULT', data);
  }

  if (oldDnsLinkRecordId) {
   console.log('DELETE OLD RECORD');
  
    const res = await fetch(`${NETIFLY_API_HOST}/dns_zones/${NETIFLY_DNS_ZONE_ID}/dns_records/${oldDnsLinkRecordId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${NETIFLY_API_KEY}`,
        "Content-Type": 'application/json',
      }
    })

    if (res.ok) {
      console.log('DELETED');
    }
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


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}