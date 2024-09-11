const fs = require('fs');
const path = require('path');
const axios = require('axios');

const { S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { PutObjectCommand } = require("@aws-sdk/client-s3");

async function generatePresignedUrl(s3Client, path) {
	const command = new PutObjectCommand({ 
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: path,
    ContentType: 'image/png'
  });
	const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return presignedUrl;
}

async function uploadFileToS3(s3Client, key, filePath) {
  try {
    // Generate the presigned URL
    const presignedUrl = await generatePresignedUrl(s3Client, key);

    // Read the file to upload
    const fileStream = fs.createReadStream(filePath);
    const fileStat = fs.statSync(filePath);

    

    const extension = key.split('.')[1];
    // Perform the upload using axios (or fetch)
    const response = await axios.put(presignedUrl, fileStream, {
      headers: {
        'Content-Type': `image/${extension}`,  // Adjust according to file type
        'Content-Length': fileStat.size
      }
    });
    console.log('Image file uploaded successfully:', response.status);
    return response;
  } catch (error) {
    console.error('Error uploading file:', error.message);
    throw error.message;
  }
}


async function processProductImages(row) {
  const fileNames = row.fileName?.trim();

  if (!row.fileName?.trim()) return;

  const prePath = `${row.imageBrand?.trim().toLowerCase()}/${row.imageModel?.trim().toLowerCase()}`;
  const files = fileNames.split(',')

  const allowedExtension = ['jpeg', 'jpg', 'png'];
  const imageUrls = files.map(fileName => {
    const key = fileName.trim();
    const path = `images/${prePath}/${key}`;

    const extension = key.split('.')[1];
    if (!allowedExtension.includes(extension)) {
      throw 'Image type is invalid. Please make sure the extension is always jpeg, jpg, or png.';
    }

    return { key, path };
  })

  const filteredUrls = imageUrls.filter(item => !!item.path);


  const s3Client = new S3Client({
    region: process.env.REGION,
    endpoint: `https://s3.${process.env.REGION}.amazonaws.com`,
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SECRET_ACCESS_KEY
    }
  });

  filteredUrls.forEach(async item => {
    const key = item.key;
    const imagePath = path.join(__dirname, item.path);

    try {
      return await uploadFileToS3(s3Client, key, imagePath);
    } catch (error) {
      throw error.message;
    }
  });
}

module.exports = {
  processProductImages
};

