const fs = require('fs');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');

// Function to read and parse the CSV file
function importBrandsFromCSV(filePath) {
  const brandsSet = new Set();

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
        if (Object.keys(filteredRow).length) {
          const brandName = row.Brand?.trim();
          if (brandName) {
            brandsSet.add(brandName);
          }
        }
      })
      .on('end', () => {
        resolve([...brandsSet]); // Convert set to array
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Function to check if a brand exists in DynamoDB
async function brandExists(dynamodb, tableName, brandName) {
  const params = {
    TableName: tableName,
    IndexName: 'byName', // Use the appropriate index name if needed
    KeyConditionExpression: '#name = :name',
    ExpressionAttributeNames: {
      '#name': 'name'
    },
    ExpressionAttributeValues: {
      ':name': brandName
    }
  };

  try {
    const data = await dynamodb.query(params).promise();
    return data.Items.length > 0 ? data.Items[0].id : null;
  } catch (error) {
    console.error(`Error checking brand existence: ${brandName}`, error);
    throw error;
  }
}

// Function to insert brand data into DynamoDB
async function insertBrandIntoDynamoDB(dynamodb, tableName, brand) {
  const params = {
    TableName: tableName,
    Item: brand
  };

  try {
    await dynamodb.put(params).promise();
    console.log(`Inserted brand: ${brand.name}`);
    return brand.id;
  } catch (error) {
    console.error(`Error inserting brand: ${brand.name}`, error);
    throw error;
  }
}

// Function to process brands and ensure they are in the DynamoDB table
async function processBrands(dynamodb, tableName, filePath, brandMap) {
  try {
    const brands = await importBrandsFromCSV(filePath);
    console.log(brands)
    for (const brandName of brands) {
      let brandId = await brandExists(dynamodb, tableName, brandName);
      if (!brandId) {
        const brand = {
          id: uuidv4(), // Generate a unique ID
          __typename: 'Brand', // Assuming this is a constant value
          createdAt: new Date().toISOString(),
          name: brandName, // Use the detected brand name
          updatedAt: new Date().toISOString()
        };
        brandId = await insertBrandIntoDynamoDB(dynamodb, tableName, brand);
      } else {
        console.log(`Brand already exists: ${brandName}`);
      }
      brandMap.set(brandName, brandId);
    }
    return brandMap;
  } catch (error) {
    console.error('Error processing brands:', error);
    throw error;
  }
}

module.exports = {
  processBrands
};
