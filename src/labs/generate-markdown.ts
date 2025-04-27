import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory for Bun
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Product {
  document: {
    title: string;
    brand: string;
    repmodel: string;
    categories: {
      level1: string;
      level2: string;
      level3: string;
    };
    specs: Array<{ k: string; v: string }>;
    bestprice: number;
    images: string[];
    url_compy: string;
  };
}

interface ProductsData {
  hits: Product[];
}

interface ProductForEmbedding {
  id: string;
  metadata: {
    title: string;
    brand: string;
    model: string;
    price: number;
    category_level1: string;
    category_level2: string;
    category_level3: string;
    image_url: string;
    product_url: string;
    color?: string;
    capacity?: string;
    memory?: string;
    screen_size?: string;
    weight?: string;
    power?: string;
  };
  context: string; // Markdown content for embedding
}

function extractSpecValue(specs: Array<{ k: string; v: string }>, key: string): string | undefined {
  const specEntry = specs.find(spec => 
    spec.k.toLowerCase().includes(key.toLowerCase())
  );
  return specEntry?.v;
}

function generateProductForEmbedding(product: Product, index: number): ProductForEmbedding {
  const { document } = product;
  const { title, brand, repmodel, categories, specs, bestprice, images, url_compy } = document;
  
  // Generate unique ID
  const id = url_compy.split('/').pop() || `product-${index}`;
  
  // Extract common metadata from specs
  const color = extractSpecValue(specs, 'color');
  const capacity = extractSpecValue(specs, 'capacidad') || 
                  extractSpecValue(specs, 'memoria') || 
                  extractSpecValue(specs, 'almacenamiento');
  const memory = extractSpecValue(specs, 'memoria ram');
  const screenSize = extractSpecValue(specs, 'tamaño pantalla') || 
                    extractSpecValue(specs, 'pulgadas');
  const weight = extractSpecValue(specs, 'peso');
  const power = extractSpecValue(specs, 'potencia');
  
  // Start with product title, brand, model and price
  let markdown = `# ${title}\n\n`;
  markdown += `**Brand**: ${brand}\n`;
  markdown += `**Model**: ${repmodel}\n`;
  markdown += `**Price**: S/ ${bestprice.toFixed(2)}\n\n`;
  
  // Add category information
  markdown += `**Category**: ${categories.level1} > ${categories.level2} > ${categories.level3}\n\n`;
  
  // Add main image if available
  if (images && images.length > 0) {
    markdown += `![${title}](${images[0]})\n\n`;
  }

  // Add specifications
  markdown += '## Specifications\n\n';
  
  // Filter important specifications
  const importantSpecKeys = [
    'Capacidad', 'Potencia', 'Color', 'Material', 'Garantía', 'Características',
    'Modelo', 'Marca', 'Tipo de Producto', 'Uso', 'Capacidad de lavado',
    'Memoria RAM', 'Memoria interna', 'Procesador', 'Tamaño pantalla',
    'Resolución', 'Sistema operativo', 'Tecnología', 'Peso', 'Dimensiones'
  ];
  
  // Group specs by importance
  const criticalSpecs = specs.filter(spec => 
    importantSpecKeys.some(key => spec.k.toLowerCase().includes(key.toLowerCase()))
  );
  
  // Sort specs alphabetically by key
  criticalSpecs.sort((a, b) => a.k.localeCompare(b.k));
  
  // Add specs in a table format
  if (criticalSpecs.length > 0) {
    markdown += '| Specification | Value |\n';
    markdown += '| ------------- | ----- |\n';
    
    for (const spec of criticalSpecs) {
      // Clean up value text (remove line breaks)
      const cleanValue = spec.v.replace(/\n/g, ' ');
      markdown += `| ${spec.k} | ${cleanValue} |\n`;
    }
  } else {
    markdown += 'No detailed specifications available.\n';
  }
  
  // Add Compy URL
  markdown += `\n**View product**: [${title}](${url_compy})\n`;
  
  // Create the product object with metadata and context
  return {
    id,
    metadata: {
      title,
      brand,
      model: repmodel,
      price: bestprice,
      category_level1: categories.level1,
      category_level2: categories.level2,
      category_level3: categories.level3,
      image_url: images && images.length > 0 ? images[0] : '',
      product_url: url_compy,
      ...(color && { color }),
      ...(capacity && { capacity }),
      ...(memory && { memory }),
      ...(screenSize && { screen_size: screenSize }),
      ...(weight && { weight }),
      ...(power && { power })
    },
    context: markdown
  };
}

async function main() {
  try {
    // Read the products.json file
    const filePath = join(__dirname, 'data', 'products.json');
    const fileContent = readFileSync(filePath, 'utf8');
    const productsData: ProductsData = JSON.parse(fileContent);
    
    // Generate product objects with metadata and context for each product
    const productsForEmbedding = productsData.hits.map((product, index) => 
      generateProductForEmbedding(product, index)
    );
    
    // Create output file with the products for embedding
    const outputJson = JSON.stringify(productsForEmbedding, null, 2);
    const outputPath = join(__dirname, 'data', 'products-for-embedding.json');
    writeFileSync(outputPath, outputJson);
    
    console.log(`Successfully generated ${productsForEmbedding.length} product objects for embedding.`);
    console.log(`Output saved to: ${outputPath}`);
    
    // Show a sample of the first product
    console.log('\nSample product object for embedding:');
    console.log('---------------------------------');
    const sampleProduct = {
      id: productsForEmbedding[0].id,
      metadata: productsForEmbedding[0].metadata,
      context: `${productsForEmbedding[0].context.substring(0, 200)}...`
    };
    console.log(JSON.stringify(sampleProduct, null, 2));
    
  } catch (error) {
    console.error('Error processing products data:', error);
  }
}

main(); 