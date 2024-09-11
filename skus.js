const { processProductOptionSkus } = require('./productOptionsSku');
const { processProductImages } = require('./productImages.js');

// Function to insert SKU data into DynamoDB
async function insertSkuIntoDynamoDB(dynamodb, tableName, sku) {
  const params = {
    TableName: tableName,
    Item: sku
  };

  try {
    await dynamodb.put(params).promise();
    console.log(`Inserted SKU: ${sku.id}`);
  } catch (error) {
    console.error(`Error inserting SKU: ${sku.id}`, error);
    throw error;
  }
}

// Function to process SKUs for a product
async function processSkus(dynamodb, skuTableName, productOptionsSkuTableName, product, variations, csvRows, productOptionMap) {
  for (const row of csvRows) {
    const sku = {
      id: row.SKU.trim(), // Use the SKU ID from the CSV file
      version: 0,
      __typename: 'Sku',
      class: 'product',
      createdAt: new Date().toISOString(),
      image: row.fileName?.trim(), // Assuming image is not provided in CSV
      paymentType: product.paymentType,
      productSkusId: product.id,
      productSkusVersion: product.version,
      type: product.type,
      updatedAt: new Date().toISOString(),
      value: row.RRP, // Assuming value comes from the CSV file
      valueType: 'RRP' // Assuming a constant value
    };

    if (row.fileName?.trim()) {
      sku.image = row.fileName?.trim();
    }

    const result = await processProductImages(row);
    if (result?.status !== 200) {
      console.error(`The image is already existed`);
    }

    await insertSkuIntoDynamoDB(dynamodb, skuTableName, sku);

    const productOptionIds = [];
    for (const variation of variations) {
      const variationName = variation.name;
      const variationValue = row[`Variation:${variationName}`] ? row[`Variation:${variationName}`].trim() : null;
      if (variationValue) {
        const productOptionId = productOptionMap[`${variationName}:${variationValue}`];
        if (productOptionId) {
          productOptionIds.push(productOptionId);
        } else {
          console.error(`ProductOption ID not found for ${variationName}: ${variationValue}`);
        }
      }
    }

    await processProductOptionSkus(dynamodb, productOptionsSkuTableName, sku, productOptionIds);
  }
}

module.exports = {
  processSkus
};
