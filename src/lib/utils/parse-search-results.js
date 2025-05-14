
/**
 * Compresses product search results data into a markdown table format optimized for LLMs
 * @param {Object} data - The original product search results JSON
 * @returns {string} Compressed representation of the data as a markdown table
 */
export function compressProductData(data) {
  // Extract essential product info from each hit
  const products = data.hits.map(hit => {
    const doc = hit.document;

    // Extract all features (properties starting with "f.")
    const features = Object.keys(doc)
      .filter(key => key.startsWith('f.') && doc[key] !== 'NO ESPECIFICA')
      .map(key => `${key.substring(2)}: ${doc[key]}`)
      .join(', ');

    // Get first image if available
    const firstImage = doc.images && doc.images.length > 0 ? doc.images[0] : '';

    // Get all stores as comma-separated string
    const storesList = doc.stores ? doc.stores.join(', ') : (doc.topstore || '');

    return {
      title: doc.title,
      brand: doc.brand,
      model: doc.repmodel,
      price: doc.bestprice,
      features: features,
      image: firstImage,
      stores: storesList,
      url: doc.url_compy || doc.url,
    };
  });

  // Add summary stats
  const summary = {
    total_found: data.found,
    results_count: products.length,
    search_query: data.request_params.q,
    page: data.page
  };

  return formatAsMarkdown(products, summary);
}

/**
 * Formats product data as a markdown table
 */
function formatAsMarkdown(products, summary) {
  let output = '## Product Search Results\n';
  output += `*Query: "${summary.search_query}" - Found: ${summary.total_found} (Page ${summary.page})*\n\n`;
  output += '| Title | Brand | Model | Price | Features | Image | Stores |\n';
  output += '|-------|-------|-------|-------|----------|-------|--------|\n';

  for (const product of products) {

    // Format image as markdown link if available
    const imageCell = product.image ? `![Image](${product.image})` : '';

    output += `| ${product.title} | ${product.brand} | ${product.model} | ${product.price} | ${product.features} | ${imageCell} | ${product.stores} |\n`;
  }

  return output;
}
