import fs from 'node:fs';
import path from 'node:path';

interface Document {
  stores: string[];
}

interface Hit {
  document: Document;
}

interface OutJson {
  hits: Hit[];
}

// Read the out.json file
const outJsonPath = path.join(process.cwd(), 'cook/out.json');
const data = JSON.parse(fs.readFileSync(outJsonPath, 'utf-8')) as OutJson;

// Extract all stores from the hits
const allStores = data.hits.flatMap((hit) => hit.document.stores);

// Get unique stores
const uniqueStores = [...new Set(allStores)];

// Print the results
console.log('Unique stores:');
console.log(uniqueStores);
