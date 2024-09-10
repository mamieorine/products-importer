const fs = require('fs');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const { processVariations } = require('./variations');
const { processSkus } = require('./skus'); // Import the processSkus function

// Function to read and parse the CSV file
function importProductsFromCSV(filePath) {
  const products = new Map();

  const content = fs.readFileSync(filePath, { encoding: 'utf-8' });
  const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;

  const readable = require('stream').Readable;
  const s = new readable();
  s.push(cleanContent);
  s.push(null);

  return new Promise((resolve, reject) => {
    s.pipe(csv())
      .on('data', (row) => {

        // Check if that row is an empty row
        const filteredRow = Object.fromEntries(
          Object.entries(row).filter(([_key, value]) => value.trim() !== '')
        );
        if (!Object.keys(filteredRow).length) return;

        const productKey = row.DefaultSku?.trim();
        if (products.has(productKey)) {
          const existingProduct = products.get(productKey);
          existingProduct.csvRows.push(row);

          Object.keys(row).forEach(key => {
            if (key.startsWith('Variation:')) {
              const variationName = key.replace('Variation:', '').trim();
              const variationValue = row[key].trim();
              if (variationValue) {
                const existingVariation = existingProduct.variations.find(v => v.name === variationName);
                if (existingVariation) {
                  if (!existingVariation.values.includes(variationValue)) {
                    existingVariation.values.push(variationValue);
                  }
                } else {
                  existingProduct.variations.push({ name: variationName, values: [variationValue] });
                }
              }
            }
          });

          products.set(productKey, existingProduct);
        } else {
          const product = {
            id: uuidv4(),
            version: 0,
            __typename: 'Product',
            class: row.Class || 'product',
            createdAt: new Date().toISOString(),
            defaultSkuId: row.DefaultSku || '',
            description: row.Description || '',
            displayPrice: row.RRP || '',
            name: row['Product Name']?.trim(),
            paymentType: row['Payment Type'] || '',
            revisions: '0',
            type: row.Type || 'accessory',
            updatedAt: new Date().toISOString(),
            valueType: 'RRP'
          };

          const variations = [];
          Object.keys(row).forEach(key => {
            if (key.startsWith('Variation:')) {
              const variationName = key.replace('Variation:', '').trim();
              const variationValue = row[key].trim();
              if (variationValue) {
                variations.push({ name: variationName, values: [variationValue] });
              }
            }
          });

          if (variations.length === 0) {
            variations.push({ name: 'no-variation', values: ['no-option'] });
          }
          products.set(productKey, { brandName: row.Brand?.trim(), product, variations, csvRows: [row] });
        }
      })
      .on('end', () => {
        resolve(Array.from(products.values()));
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Function to insert product data into DynamoDB
async function insertProductIntoDynamoDB(dynamodb, tableName, product) {
  const params = {
    TableName: tableName,
    Item: product
  };

  try {
    await dynamodb.put(params).promise();
    console.log(`Inserted product: ${product.name}`);
  } catch (error) {
    console.error(`Error inserting product: ${product.name}`, error);
    throw error;
  }
}

// Function to update product version in DynamoDB
async function updateProductVersion(dynamodb, tableName, product) {
  const params = {
    TableName: tableName,
    Key: { 'id': product.id, version: product.version },
    UpdateExpression: 'set #revisions = :revisionsValue',
    ExpressionAttributeNames: {
      '#revisions': 'revisions',
    },
    ExpressionAttributeValues: {
      ':revisionsValue': parseInt(product.revisions) + 1,
    },
    ReturnValues: 'UPDATED_NEW'
  };

  try {
    const result = await dynamodb.update(params).promise();
    return result.Attributes;
  } catch (error) {
    console.error(`Error updating product: ${product.name}`, error);
    throw error;
  }
}

// Function to check if a product exists in DynamoDB
async function productExists(dynamodb, tableName, product) {
  const params = {
    TableName: tableName,
    IndexName: 'byDefaultSku', // Use the appropriate index name if needed
    KeyConditionExpression: '#defaultSkuId = :defaultSkuId',
    ExpressionAttributeNames: {
      '#defaultSkuId': 'defaultSkuId'
    },
    ExpressionAttributeValues: {
      ':defaultSkuId': product.defaultSkuId
    }
  };


  try {
    const data = await dynamodb.query(params).promise();
    return data.Items.length > 0 ? data.Items[0] : null;
  } catch (error) {
    console.error(`Error checking brand existence: ${product.name}`, error);
    throw error;
  }
}

// Function to process products and link them to the corresponding brand, variations, and SKUs
async function processProducts(dynamodb, productTableName, variationTableName, productOptionTableName, skuTableName, productOptionsSkuTableName, brandMap, filePath) {
  try {
    const products = await importProductsFromCSV(filePath);
    for (const { brandName, product, variations, csvRows } of products) {
      const productExisted = await productExists(dynamodb, productTableName, product);
      const brandId = brandMap.get(brandName);

      if (!productExisted?.id && brandId) {
        product.brandProductsId = brandId;

        // insert the product if the product is not existed
        await insertProductIntoDynamoDB(dynamodb, productTableName, product);
      } else if (productExisted?.id) {
        console.log(`Product already exists: ${brandName} - ${product.name}`);

        // Update the product version if the product is existed
        const updatedProduct = await updateProductVersion(dynamodb, productTableName, productExisted);
        product.version = updatedProduct.revisions;
        product.revisions = updatedProduct.revisions;
        console.log(`Update product revisions: ${brandName} - ${product.name} - Revision ${updatedProduct.revisions}`);
      } else if (!brandId) {
        console.log(`Brand ID not found for product: ${product.name}, brand: ${brandName}`);
      }

      const productOptionMap = await processVariations(dynamodb, variationTableName, productOptionTableName, product, variations);
      await processSkus(dynamodb, skuTableName, productOptionsSkuTableName, productOptionTableName, product, variations, csvRows, productOptionMap); // Process SKUs
    }
    console.log('Product import completed.');
  } catch (error) {
    console.error('Error importing products:', error);
    throw error;
  }
}

module.exports = {
  processProducts
};
