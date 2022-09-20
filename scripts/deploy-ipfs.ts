import dotenv from "dotenv";
import fs from "fs-extra";
import recursive from "recursive-fs";
import FormData from "form-data";
import basePathConverter from "base-path-converter";
import fetch from 'node-fetch';

const { PINATA_API_KEY, PINATA_API_SECRET } = dotenv.config().parsed as any;

console.log(PINATA_API_KEY, PINATA_API_SECRET);

const PINATA_API_PINFILETOIPFS = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export const uploadAssets = async (folder: any): Promise<any> => {
    try {
      const folderPath = folder;

      const { files } = await recursive.read(folderPath);

      console.log('files', files);
  
      if (files?.length <= 0) {
        console.info("No files were found in folder path.");
        return;
      }

      const formData: any = new FormData();

      files.forEach((filePath: any) => {
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
      
      console.log("CID", res)

    } catch (error) {
      console.error(error);
        
      // @ts-ignore
      process.exit(1);
    }
  };

  uploadAssets('./dist');