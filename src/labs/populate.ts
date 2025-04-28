import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vectorIndex } from "@/lib/vector";

interface ProductData {
	id: string;
	context: string;
	metadata: Record<
		string,
		string | number | boolean | null | undefined | string[]
	>;
}

async function main() {
	const productsData = JSON.parse(
		readFileSync(join(__dirname, "data", "products.json"), "utf8"),
	);

	// Format products for vector index
	const formattedProducts = productsData.map((product: ProductData) => ({
		id: product.id,
		data: product.context,
		metadata: product.metadata,
	}));

	// Batch upload to avoid "Exceeded max batch write limit: 1000" error
	const BATCH_SIZE = 500; // Safe batch size below the 1000 limit

	console.log(
		`Uploading ${formattedProducts.length} products in batches of ${BATCH_SIZE}...`,
	);

	for (let i = 0; i < formattedProducts.length; i += BATCH_SIZE) {
		const batch = formattedProducts.slice(i, i + BATCH_SIZE);
		console.log(
			`Uploading batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(formattedProducts.length / BATCH_SIZE)} (${batch.length} products)...`,
		);
		await vectorIndex.upsert(batch);
	}

	console.log(
		`Successfully uploaded ${formattedProducts.length} products to vector index.`,
	);
}

main().catch((error) => {
	console.error("Error populating vector index:", error);
	process.exit(1);
});
