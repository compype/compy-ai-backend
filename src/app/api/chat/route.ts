import { vectorIndex } from "@/lib/vector";
import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
	const { messages } = await req.json();

	const result = streamText({
		model: openai("gpt-4o"),
		messages,
		system: `You are a helpful product recommendation assistant for Compy.
    Use the searchProducts tool to find relevant products based on the user's query.
    If no relevant products are found, suggest searching with different terms.
    
    FORMAT YOUR RESPONSES USING MARKDOWN:
    - Use markdown formatting for all responses
    - Use ## for section headings
    - Use **bold** for important information like prices and product names
    - Use tables for presenting specifications with the following format:
      | Specification | Value |
      | ------------- | ----- |
      | Feature 1     | Value 1 |
    - Use bullet points for listing features
    - Use markdown image syntax when referring to products
    
    When describing products:
    - Be concise but highlight key features, price, and specifications
    - Always include the product price in your response
    - Format prices as "S/ XXX.XX"
    - For multiple products, present a numbered list with brief descriptions
    - Include a comparison table if showing multiple similar products`,
		tools: {
			searchProducts: tool({
				description: "Search for products in the Compy catalog",
				parameters: z.object({
					query: z
						.string()
						.describe("The search query to find relevant products"),
					category: z
						.string()
						.optional()
						.describe(
							"Optional category to filter by (e.g., Electrohogar, Tecnologia)",
						),
					brand: z
						.string()
						.optional()
						.describe(
							"Optional brand to filter by (e.g., SAMSUNG, LG, INDURAMA)",
						),
					priceMax: z
						.number()
						.optional()
						.describe("Maximum price to filter by"),
				}),
				execute: async ({ query, category, brand, priceMax }) => {
					// Prepare filter based on optional parameters
					const filter = [];

					if (category) {
						filter.push(`category_level1 = '${category}'`);
					}

					if (brand) {
						filter.push(`brand = '${brand}'`);
					}

					if (priceMax && priceMax > 0) {
						filter.push(`price <= ${priceMax}`);
					}

					// Convert array to filter string if any filters exist
					const filterString =
						filter.length > 0 ? filter.join(" AND ") : undefined;

					console.log(`Searching for: ${query} with filter: ${filterString}`);

					// Query the vector database using our typed helper function
					const results = await vectorIndex.query({
						data: query,
						topK: 5,
						filter: filterString,
						includeMetadata: true,
					});

					if (results.length === 0) {
						return {
							products: [],
							query,
							total: 0,
						};
					}

					// Format the product data and prepare markdown tables for features
					return {
						products: results.map((match) => {
							// Extract any features or specifications to format as markdown
							const features = [];
							const specs = [];

							// Add any markdown formatted specifications table
							if (match.metadata?.specifications) {
								specs.push(
									formatSpecsAsMarkdown(match.metadata.specifications),
								);
							}

							// Add any markdown formatted features
							if (match.metadata?.features) {
								features.push(
									formatFeaturesAsMarkdown(match.metadata.features),
								);
							}

							return {
								id: match.id,
								title: match.metadata?.title,
								brand: match.metadata?.brand,
								model: match.metadata?.model,
								price: match.metadata?.price,
								category: `${match.metadata?.category_level1} > ${match.metadata?.category_level2} > ${match.metadata?.category_level3}`,
								product_url: match.metadata?.product_url,
								image_url: match.metadata?.image_url,
								// Include additional metadata that might be useful
								color: match.metadata?.color,
								capacity: match.metadata?.capacity,
								memory: match.metadata?.memory,
								screen_size: match.metadata?.screen_size,
								weight: match.metadata?.weight,
								power: match.metadata?.power,
								// Add markdown formatted content
								features_markdown: features.join("\n\n"),
								specifications_markdown: specs.join("\n\n"),
								// Explicitly add a View Product link for markdown rendering
								view_product_link: `[View Product](${match.metadata?.product_url})`,
							};
						}),
						query,
						total: results.length,
					};
				},
			}),
		},
	});

	return result.toDataStreamResponse();
}

// Helper function to format specifications as a markdown table
function formatSpecsAsMarkdown(
	specs: Record<string, unknown> | Array<{ k: string; v: string }> | unknown,
): string {
	if (!specs || typeof specs !== "object") return "";

	let markdown = "### Specifications\n\n";
	markdown += "| Specification | Value |\n";
	markdown += "| ------------- | ----- |\n";

	// If specs is an array of key-value objects
	if (Array.isArray(specs)) {
		for (const spec of specs) {
			if (spec.k && spec.v) {
				markdown += `| ${spec.k} | ${spec.v} |\n`;
			}
		}
	} else {
		// If specs is a key-value object
		for (const [key, value] of Object.entries(specs)) {
			markdown += `| ${key} | ${value} |\n`;
		}
	}

	return markdown;
}

// Helper function to format features as a markdown list
function formatFeaturesAsMarkdown(
	features: string | string[] | Record<string, unknown> | unknown,
): string {
	if (!features) return "";

	let markdown = "### Key Features\n\n";

	if (typeof features === "string") {
		// If features is just a string, format it directly
		markdown += features
			.split(".")
			.filter((f) => f.trim())
			.map((f) => `- ${f.trim()}`)
			.join("\n");
	} else if (Array.isArray(features)) {
		// If features is an array
		markdown += features.map((f) => `- ${f}`).join("\n");
	} else if (typeof features === "object") {
		// If features is an object
		for (const [key, value] of Object.entries(
			features as Record<string, unknown>,
		)) {
			markdown += `- **${key}**: ${value}\n`;
		}
	}

	return markdown;
}
