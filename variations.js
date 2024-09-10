const { v4: uuidv4 } = require('uuid');
const { processProductOptions } = require('./productOptions');

async function insertVariationIntoDynamoDB(dynamodb, tableName, variation) {
  const params = {
    TableName: tableName,
    Item: variation
  };

  try {
    await dynamodb.put(params).promise();
    console.log(`Inserted variation: ${variation.name}`);
  } catch (error) {
    console.error(`Error inserting variation: ${variation.name}`, error);
    throw error;
  }
}

async function processVariations(dynamodb, variationTableName, productOptionTableName, product, variations) {
  const productOptionMap = {}; // Map to store product option IDs

  for (const variation of variations) {
    const variationItem = {
      id: uuidv4(),
      __typename: 'ProductVariation',
      createdAt: new Date().toISOString(),
      displayType: variation.displayType || 'dropdown',
      name: variation.name,
      productVariationsId: product.id,
      productVariationsVersion: product.version,
      type: 'custom',
      updatedAt: new Date().toISOString()
    };

    await insertVariationIntoDynamoDB(dynamodb, variationTableName, variationItem);
    variation.id = variationItem.id; // Store the variation ID
    await processProductOptions(dynamodb, productOptionTableName, variation, productOptionMap);
  }

  return productOptionMap; // Return the map of product option IDs
}

module.exports = {
  processVariations
};
