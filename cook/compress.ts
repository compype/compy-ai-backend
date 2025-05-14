import * as fs from 'node:fs';
import * as path from 'node:path';
import { compressProductData } from '@/lib/utils/parse-search-results';

// Define a type for the expected JSON structure
interface ProductSearchResults {
  facet_counts: unknown[];
  found: number;
  hits: Array<{
    document: {
      active: boolean;
      bestprice: number;
      brand: string;
      title: string;
      repmodel: string;
      topstore?: string;
      stores?: string[];
      images?: string[];
      url_compy?: string;
      url: string;
      [key: string]: unknown;
    };
    highlights?: Array<{
      field: string;
      matched_tokens: string[];
      snippet: string;
    }>;
    text_match: number;
    text_match_info?: Record<string, string | number>;
  }>;
  request_params: {
    collection_name: string;
    per_page: number;
    q: string;
  };
  page: number;
  out_of: number;
  search_time_ms: number;
}

// Function to test and output the compressed data
function testCompression(): void {
  try {
    // Load the JSON data
    const jsonPath = path.join(__dirname, 'out.json');
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(jsonData) as ProductSearchResults;

    console.log('\n===== MARKDOWN TABLE =====\n');
    const markdown = compressProductData(data);
    console.log(markdown);

    // Save output to file for reference
    fs.writeFileSync(path.join(__dirname, 'products.md'), markdown);

    console.log('\nCompressed output has been saved to:');
    console.log('- cook/products.md');
  } catch (error) {
    console.error('Error during compression test:', error);
  }
}

// Run the test
testCompression(); 