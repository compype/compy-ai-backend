import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get current directory for Bun
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Original interface - keeping for backward compatibility
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

// New enhanced product interface based on the provided JSON structure
interface EnhancedProduct {
	_id: { $oid: string };
	repmodel: string;
	active: boolean;
	bestprice: number;
	brand: string;
	categories: {
		level1: string;
		level2: string;
		level3: string;
	};
	category: string;
	desc: string;
	filters?: Array<{
		key: string;
		store: string;
		size: number;
		features: Array<{ k: string; v: string }>;
		updated: { $date: string };
		time: { $date: string };
	}>;
	homologated: number;
	images: Array<{
		key: string;
		title: string;
		store: string;
		size: number;
		urls: string[];
		updated: { $date: string };
		bestprice?: number;
	}>;
	key: string;
	metrics?: {
		percent_offer: number;
		median_hist: number;
		prev_price: number;
		amt_change: number;
		amt_change_text: string;
		percent_change: number;
		price_minimum: number;
		isminimum: boolean;
		percent_save: number;
	};
	model: string;
	numtiendas: number;
	price: number;
	price_card: number | null;
	skus: Array<{
		priority: number;
		sku: string;
		brand: string;
		category: string;
		subcategory: string;
		key: string;
		title: string;
		titleurl: string;
		store: string;
		model: string;
		url: string;
		price: number;
		bestprice: number;
		homologated: number;
		updated: { $date: string };
		stock?: number;
		price_card?: number | null;
	}>;
	specs: Array<{
		key: string;
		title: string;
		store: string;
		size: number;
		specs: Array<{ k: string; v: string }>;
		updated: { $date: string };
	}>;
	stock: number;
	store: string;
	subcategory: string;
	tags: string[];
	title: string;
	topstore: string;
	toptitle: string;
	url: string;
	url_search: string;
}

interface ProductsData {
	hits?: Product[]; // Original structure
	products?: EnhancedProduct[]; // New structure
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
		description?: string;
		stores?: Array<{ store: string; price: number; url: string }>;
		price_history?: {
			current: number;
			previous: number;
			minimum: number;
			percent_save?: number;
		};
	};
	context: string; // Markdown content for embedding
}

function extractSpecValue(
	specs: Array<{ k: string; v: string }>,
	key: string,
): string | undefined {
	const specEntry = specs.find((spec) =>
		spec.k.toLowerCase().includes(key.toLowerCase()),
	);
	return specEntry?.v;
}

// Enhanced version to handle the new product structure
function generateProductForEmbedding(
	product: Product | EnhancedProduct,
	index: number,
): ProductForEmbedding {
	// Handle both old and new product structures
	if ("document" in product) {
		// Original structure
		return generateProductForEmbeddingLegacy(product, index);
	}

	// New enhanced structure
	const {
		_id,
		title,
		brand,
		repmodel,
		categories,
		bestprice,
		desc,
		metrics,
		url,
		skus,
		specs,
		images,
	} = product;

	// Generate unique ID
	const id = _id?.$oid || url.split("/").pop() || `product-${index}`;

	// Collect all specs from the specs array if available
	let allSpecs: Array<{ k: string; v: string }> = [];
	if (specs && specs.length > 0 && specs[0].specs) {
		allSpecs = specs[0].specs;
	}

	// Extract common metadata from specs
	const color = extractSpecValue(allSpecs, "color");
	const capacity =
		extractSpecValue(allSpecs, "capacidad") ||
		extractSpecValue(allSpecs, "memoria") ||
		extractSpecValue(allSpecs, "almacenamiento");
	const memory = extractSpecValue(allSpecs, "memoria ram");
	const screenSize =
		extractSpecValue(allSpecs, "tamaño de la pantalla") ||
		extractSpecValue(allSpecs, "tamaño pantalla") ||
		extractSpecValue(allSpecs, "pulgadas");
	const weight = extractSpecValue(allSpecs, "peso");
	const power =
		extractSpecValue(allSpecs, "potencia") ||
		extractSpecValue(allSpecs, "potencia de parlantes");
	const resolution =
		extractSpecValue(allSpecs, "resolución de imagen") ||
		extractSpecValue(allSpecs, "resolución");

	// Start with product title, brand, model and price
	let markdown = `# ${title}\n\n`;

	// Add description if available
	if (desc) {
		markdown += `${desc}\n\n`;
	}

	markdown += `**Brand**: ${brand}\n`;
	markdown += `**Model**: ${repmodel}\n`;
	markdown += `**Price**: S/ ${bestprice.toFixed(2)}\n`;

	// Add price history and comparison if available
	if (metrics) {
		if (metrics.prev_price !== bestprice) {
			markdown += `**Previous Price**: S/ ${metrics.prev_price.toFixed(2)}\n`;
		}
		if (metrics.price_minimum < bestprice) {
			markdown += `**Lowest Price**: S/ ${metrics.price_minimum.toFixed(2)}\n`;
		}
		if (metrics.percent_save > 0) {
			markdown += `**Save**: ${metrics.percent_save.toFixed(2)}%\n`;
		}
	}

	markdown += `\n`;

	// Add category information
	markdown += `**Category**: ${categories.level1} > ${categories.level2} > ${categories.level3}\n\n`;

	// Add main image if available
	const imageUrls = images && images.length > 0 ? images[0].urls : [];
	if (imageUrls && imageUrls.length > 0) {
		markdown += `![${title}](${imageUrls[0]})\n\n`;
	}

	// Add specifications
	markdown += "## Specifications\n\n";

	// Filter important specifications by grouping them into categories
	const technicalSpecs = allSpecs.filter((spec) =>
		[
			"resolución",
			"tecnología",
			"sistema operativo",
			"procesador",
			"pantalla",
			"memoria",
		].some((key) => spec.k.toLowerCase().includes(key.toLowerCase())),
	);

	const connectivitySpecs = allSpecs.filter((spec) =>
		["hdmi", "usb", "conexión", "puerto", "bluetooth", "wifi"].some((key) =>
			spec.k.toLowerCase().includes(key.toLowerCase()),
		),
	);

	const physicalSpecs = allSpecs.filter((spec) =>
		["dimensiones", "peso", "alto", "ancho", "profundidad", "color"].some(
			(key) => spec.k.toLowerCase().includes(key.toLowerCase()),
		),
	);

	const generalSpecs = allSpecs.filter(
		(spec) =>
			!technicalSpecs.includes(spec) &&
			!connectivitySpecs.includes(spec) &&
			!physicalSpecs.includes(spec),
	);

	// Function to add specs to markdown
	const addSpecsSection = (
		sectionTitle: string,
		sectionSpecs: Array<{ k: string; v: string }>,
	) => {
		if (sectionSpecs.length > 0) {
			markdown += "### " + sectionTitle + "\n\n";
			markdown += "| Specification | Value |\n";
			markdown += "| ------------- | ----- |\n";

			// Sort specs alphabetically by key
			sectionSpecs.sort((a, b) => a.k.localeCompare(b.k));

			for (const spec of sectionSpecs) {
				// Clean up value text (remove line breaks)
				const cleanValue = spec.v.replace(/\n/g, " ");
				markdown += `| ${spec.k} | ${cleanValue} |\n`;
			}
			markdown += "\n";
		}
	};

	// Add specs by category
	if (technicalSpecs.length > 0) {
		addSpecsSection("Technical Specifications", technicalSpecs);
	}

	if (connectivitySpecs.length > 0) {
		addSpecsSection("Connectivity", connectivitySpecs);
	}

	if (physicalSpecs.length > 0) {
		addSpecsSection("Physical Characteristics", physicalSpecs);
	}

	if (generalSpecs.length > 0) {
		addSpecsSection("Other Specifications", generalSpecs);
	}

	// Add store availability and prices
	if (skus && skus.length > 0) {
		markdown += "## Available at\n\n";
		markdown += "| Store | Price | Stock |\n";
		markdown += "| ----- | ----- | ----- |\n";

		// Sort by price
		const sortedSkus = [...skus].sort((a, b) => a.bestprice - b.bestprice);

		for (const sku of sortedSkus) {
			markdown += `| [${sku.store}](${sku.url}) | S/ ${sku.bestprice.toFixed(2)} | ${sku.stock || "N/A"} |\n`;
		}
		markdown += "\n";
	}

	// Add additional images if available
	if (imageUrls && imageUrls.length > 1) {
		markdown += "## Additional Images\n\n";
		for (let i = 1; i < Math.min(imageUrls.length, 5); i++) {
			markdown += `![${title} - Image ${i + 1}](${imageUrls[i]})\n\n`;
		}
	}

	// Add product URL
	markdown += `**View product**: [${title}](${url})\n`;

	// Store information for multiple stores
	const storeInfo =
		skus?.map((sku) => ({
			store: sku.store,
			price: sku.bestprice,
			url: sku.url,
		})) || [];

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
			image_url: imageUrls && imageUrls.length > 0 ? imageUrls[0] : "",
			product_url: url,
			description: desc,
			stores: storeInfo,
			price_history: metrics
				? {
						current: bestprice,
						previous: metrics.prev_price,
						minimum: metrics.price_minimum,
						percent_save: metrics.percent_save,
					}
				: undefined,
			...(color && { color }),
			...(capacity && { capacity }),
			...(memory && { memory }),
			...(screenSize && { screen_size: screenSize }),
			...(weight && { weight }),
			...(power && { power }),
			...(resolution && { resolution }),
		},
		context: markdown,
	};
}

// Original function for backward compatibility
function generateProductForEmbeddingLegacy(
	product: Product,
	index: number,
): ProductForEmbedding {
	const { document } = product;
	const {
		title,
		brand,
		repmodel,
		categories,
		specs,
		bestprice,
		images,
		url_compy,
	} = document;

	// Generate unique ID
	const id = url_compy.split("/").pop() ?? `product-${index}`;

	// Extract common metadata from specs
	const color = extractSpecValue(specs, "color");
	const capacity =
		extractSpecValue(specs, "capacidad") ??
		extractSpecValue(specs, "memoria") ??
		extractSpecValue(specs, "almacenamiento");
	const memory = extractSpecValue(specs, "memoria ram");
	const screenSize =
		extractSpecValue(specs, "tamaño pantalla") ??
		extractSpecValue(specs, "pulgadas");
	const weight = extractSpecValue(specs, "peso");
	const power = extractSpecValue(specs, "potencia");

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
	markdown += "## Specifications\n\n";

	// Filter important specifications
	const importantSpecKeys = [
		"Capacidad",
		"Potencia",
		"Color",
		"Material",
		"Garantía",
		"Características",
		"Modelo",
		"Marca",
		"Tipo de Producto",
		"Uso",
		"Capacidad de lavado",
		"Memoria RAM",
		"Memoria interna",
		"Procesador",
		"Tamaño pantalla",
		"Resolución",
		"Sistema operativo",
		"Tecnología",
		"Peso",
		"Dimensiones",
	];

	// Group specs by importance
	const criticalSpecs = specs.filter((spec) =>
		importantSpecKeys.some((key) =>
			spec.k.toLowerCase().includes(key.toLowerCase()),
		),
	);

	// Sort specs alphabetically by key
	criticalSpecs.sort((a, b) => a.k.localeCompare(b.k));

	// Add specs in a table format
	if (criticalSpecs.length > 0) {
		markdown += "| Specification | Value |\n";
		markdown += "| ------------- | ----- |\n";

		for (const spec of criticalSpecs) {
			// Clean up value text (remove line breaks)
			const cleanValue = spec.v.replace(/\n/g, " ");
			markdown += `| ${spec.k} | ${cleanValue} |\n`;
		}
	} else {
		markdown += "No detailed specifications available.\n";
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
			image_url: images && images.length > 0 ? images[0] : "",
			product_url: url_compy,
			...(color && { color }),
			...(capacity && { capacity }),
			...(memory && { memory }),
			...(screenSize && { screen_size: screenSize }),
			...(weight && { weight }),
			...(power && { power }),
		},
		context: markdown,
	};
}

async function main() {
	try {
		// Read the products.json file
		const filePath = join(__dirname, "data", "tech-products.json");
		const fileContent = readFileSync(filePath, "utf8");
		const productsData: ProductsData = JSON.parse(fileContent);

		// Handle both old and new data structures
		const products = productsData;

		// Generate product objects with metadata and context for each product
		const productsForEmbedding = products.map((product, index) =>
			generateProductForEmbedding(product as Product | EnhancedProduct, index),
		);

		// Create output file with the products for embedding
		const outputJson = JSON.stringify(productsForEmbedding, null, 2);
		const outputPath = join(__dirname, "data", "products.json");
		writeFileSync(outputPath, outputJson);

		console.log(
			`Successfully generated ${productsForEmbedding.length} product objects for embedding.`,
		);
		console.log(`Output saved to: ${outputPath}`);

		// Show a sample of the first product
		console.log("\nSample product object for embedding:");
		console.log("---------------------------------");
		const sampleProduct = {
			id: productsForEmbedding[0].id,
			metadata: productsForEmbedding[0].metadata,
			context: `${productsForEmbedding[0].context.substring(0, 200)}...`,
		};
		console.log(JSON.stringify(sampleProduct, null, 2));
	} catch (error) {
		console.error("Error processing products data:", error);
	}
}

main();
