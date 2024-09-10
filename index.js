const AWS = require('aws-sdk');
const { processBrands } = require('./brands');
const { processProducts } = require('./products');
const dotenv = require('dotenv');

dotenv.config();

// Configure AWS credentials
AWS.config.update({
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: process.env.REGION
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const brandTableName = `Brand-${process.env.TABLE_KEY}-NONE`;
const productTableName = `Product-${process.env.TABLE_KEY}-NONE`;
const variationTableName = `ProductVariation-${process.env.TABLE_KEY}-NONE`;
const productOptionTableName = `ProductOption-${process.env.TABLE_KEY}-NONE`;
const skuTableName = `Sku-${process.env.TABLE_KEY}-NONE`;
const productOptionsSkuTableName = `ProductOptionSku-${process.env.TABLE_KEY}-NONE`;

// Function to check if a table exists
async function checkTableExists(tableName) {
  const dynamodb = new AWS.DynamoDB();
  try {
    await dynamodb.describeTable({ TableName: tableName }).promise();
    console.log(`Table ${tableName} exists.`);
  } catch (error) {
    if (error.code === 'ResourceNotFoundException') {
      console.error(`Table ${tableName} does not exist.`);
      throw new Error(`Table ${tableName} does not exist.`);
    } else {
      console.error(`Error checking table ${tableName}:`, error);
      throw error;
    }
  }
}

// Main function to execute the import
async function main() {
  const filePath = './products-new.csv'; // Update with your actual file path for the combined CSV file

  try {
    await checkTableExists(brandTableName);
    await checkTableExists(productTableName);
    await checkTableExists(variationTableName);
    await checkTableExists(productOptionTableName);
    await checkTableExists(skuTableName);
    await checkTableExists(productOptionsSkuTableName);

    const brandMap = new Map(); // Replace with actual brand mapping retrieval
    // Load brands into brandMap...
    await processBrands(dynamodb, brandTableName, filePath, brandMap);
    await processProducts(dynamodb, productTableName, variationTableName, productOptionTableName, skuTableName, productOptionsSkuTableName, brandMap, filePath);

    console.log('Import process completed.');
  } catch (error) {
    console.error('Error in import process:', error);
  }
}


main();