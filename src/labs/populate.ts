import { vectorIndex } from "@/lib/vector";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
	const products = JSON.parse(
		readFileSync(
			join(__dirname, "data", "products-for-embedding.json"),
			"utf8",
		),
	);
	await vectorIndex.upsert(
		products.map(
			(product: {
				id: string;
				context: string;
				metadata: Record<string, string>;
			}) => ({
				id: product.id,
				data: product.context,
				metadata: product.metadata,
			}),
		),
	);
}

main();
