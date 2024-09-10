const { v4: uuidv4 } = require('uuid');

// Function to insert product option data into DynamoDB
async function insertProductOptionIntoDynamoDB(dynamodb, tableName, productOption) {
  const params = {
    TableName: tableName,
    Item: productOption
  };

  try {
    await dynamodb.put(params).promise();
    console.log(`Inserted product option: ${productOption.name}`);
  } catch (error) {
    console.error(`Error inserting product option: ${productOption.name}`, error);
    throw error;
  }
}

// Function to process product options for a variation
async function processProductOptions(dynamodb, productOptionTableName, variation, productOptionMap) {
  const productOptions = variation.values && variation.values.length ? variation.values : ['no-option'];

  for (const optionName of productOptions) {
    const productOptionItem = {
      id: uuidv4(),
      __typename: 'ProductOption',
      createdAt: new Date().toISOString(),
      name: optionName,
      productVariationOptionsId: variation.id,
      updatedAt: new Date().toISOString(),
    };
    await insertProductOptionIntoDynamoDB(dynamodb, productOptionTableName, productOptionItem);
    productOptionMap[`${variation.name}:${optionName}`] = productOptionItem.id;
  }
}

module.exports = {
  processProductOptions
};
