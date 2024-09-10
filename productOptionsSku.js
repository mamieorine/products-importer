const { v4: uuidv4 } = require('uuid');

// Function to insert ProductOptionSku data into DynamoDB
async function insertProductOptionSkuIntoDynamoDB(dynamodb, tableName, productOptionSku) {
  const params = {
    TableName: tableName,
    Item: productOptionSku
  };

  try {
    await dynamodb.put(params).promise();
    console.log(`Inserted ProductOptionSku: ${productOptionSku.id}`);
  } catch (error) {
    console.error(`Error inserting ProductOptionSku: ${productOptionSku.id}`, error);
    throw error;
  }
}

// Function to process ProductOptionSku mappings for a SKU
async function processProductOptionSkus(dynamodb, productOptionsSkuTableName, sku, productOptionIds) {
  for (const productOptionId of productOptionIds) {
    const productOptionSkuItem = {
      id: uuidv4(),
      __typename: 'ProductOptionSku',
      createdAt: new Date().toISOString(),
      productOptionId: productOptionId,
      skuId: sku.id,
      skuversion: sku.version,
      updatedAt: new Date().toISOString()
    };
    await insertProductOptionSkuIntoDynamoDB(dynamodb, productOptionsSkuTableName, productOptionSkuItem);
  }
}

module.exports = {
  processProductOptionSkus
};