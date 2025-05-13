import { openai } from "@ai-sdk/openai";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { streamText, tool } from "ai";
import { z } from "zod";

// Initialize Upstash Redis and Ratelimit
const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(20, "1 m"), // 20 requests per minute
	analytics: true,
	prefix: "@compy/chat",
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Define interfaces for the metadata types
interface PriceHistory {
	current: number;
	previous: number;
	minimum: number;
	percent_save?: number;
}

interface StoreInfo {
	store: string;
	price: number;
	url: string;
}

export async function POST(req: Request) {
	// Get user information for rate limiting
	const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
	const userAgent = req.headers.get("user-agent") ?? "unknown";

	// Create a hash from IP and user agent for rate limiting
	const identifier = `${ip}:${userAgent}`;

	// Apply rate limiting
	const { success, limit, reset, remaining, pending } =
		await ratelimit.limit(identifier);

	// Ensure rate limit operations complete in serverless environment
	// @ts-ignore - Vercel specific API
	if (pending && req.waitUntil) {
		// @ts-ignore - Vercel specific API
		req.waitUntil(pending);
	}

	// If rate limit exceeded, return 429 Too Many Requests
	if (!success) {
		return new Response(
			JSON.stringify({
				error: "Too many requests",
				message: "You've reached the maximum number of requests allowed.",
				limit,
				remaining,
				reset: new Date(reset).toISOString(),
				resetSeconds: Math.ceil((reset - Date.now()) / 1000),
			}),
			{
				status: 429,
				headers: {
					"Content-Type": "application/json",
					"X-RateLimit-Limit": limit.toString(),
					"X-RateLimit-Remaining": remaining.toString(),
					"X-RateLimit-Reset": new Date(reset).toISOString(),
				},
			},
		);
	}

	const { messages } = await req.json();

	const result = streamText({
		model: openai("gpt-4o"),
		messages,
		system: `You are a helpful product recommendation assistant for Compy.
    Your main purpose is to provide information in the clearest way possible to help users make informed purchasing decisions.
    The core focus of Compy is to inform users about historical price changes, helping them understand if current prices represent good value.
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
    - Emphasize price savings when available - show both current price and previous price
    - If a product has price history data, mention the lowest historical price and percentage savings
    - For multiple products, present a numbered list with brief descriptions
    - Include a comparison table if showing multiple similar products
		- Include images when possible
		- Answer in the same language as the user's query
    
    PRICE INFORMATION:
    - ALWAYS prioritize sharing historical price data - this is Compy's most valuable service to users
    - Always highlight price advantages using this format: "Current price: S/ XXX.XX (Previous: S/ YYY.YY, Save: Z%)"
    - If lowest historical price is available, include it as: "Lowest recorded price: S/ XXX.XX"
    - When showing price changes, indicate if the current price is a good deal based on historical data
    - Include a price history summary for each product (e.g., "Price has dropped 15% since last month")
    - Always note if current price is at or near historical minimum
    - If a product frequently goes on sale, mention this to the user
    - Calculate and show the price difference between current and historical minimum as a percentage
    
    BUYING RECOMMENDATIONS:
    - Compare current prices to historical minimums and explicitly advise the user
    - If current price is more than 30% higher than historical minimum, advise the user they might want to wait
    - For example, if minimum was S/ 899 and current is S/ 2179, clearly state this is not a good time to buy
    - Label each product with a buying recommendation status: "Good time to buy", "Consider waiting", or "Wait for better offer"
    - When multiple products are available, prioritize recommending those closer to their historical minimum prices
    - Explain the price difference with specific numbers (e.g., "Current price is 142% higher than historical minimum")
    
    PRODUCT LINKS:
    - ONLY provide links to Compy's platform, NEVER to other retailers
    - Always include a "View on Compy" link at the end of each product description
    - Use the product_url from metadata for the Compy link
    - Format links as: [View on Compy](https://www.compy.pe/...)
    
    ADDITIONAL INFORMATION:
    - If store availability data exists, mention how many retailers carry the product
    - Include resolution information for screens and displays when available
    - If product description exists, use it to enhance your response
    - Mention key technical specifications from the metadata like memory, capacity, power, etc.
    
    COMPARISON SUMMARIES:
    - When presenting multiple products, finish with a summary comparison table
    - Include key differentiating features, specifications, and prices in the comparison table
    - Highlight the best value options based on price-to-performance ratio
    - Always include historical price trends in comparison tables when available
    - Add a "Price Recommendation" column showing buy/wait recommendation based on historical data`,
		tools: {
			searchProducts: tool({
				description: "Search for products in the Compy catalog",
				parameters: z.object({
					query: z
						.string()
						.describe("The search query to find relevant products. Must be in Spanish and singular. A product like 'celular', 'laptop'"),
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
				execute: async ({ query, brand, priceMax }) => {

					const myHeaders = new Headers();
					myHeaders.append("X-TYPESENSE-API-KEY", process.env.TYPESENSE_API_KEY || "");

					const requestOptions: RequestInit = {
						method: "GET",
						headers: myHeaders,
						redirect: "follow"
					};

					const queryByItems = []
					if (brand) {
						queryByItems.push(`brand:${brand}`);
					}

					if (priceMax) {
						queryByItems.push(`bestprice:<${priceMax}`);
					}

					const searchParams = new URLSearchParams({
						q: query,
						query_by: "title,repmodel",
						sort_by: "top:desc,percent_offer:desc",
						per_page: "10"
					});

					if (queryByItems.length > 0) {
						searchParams.set("filter_by", queryByItems.join("&&"));
					}

					const response = await fetch(`http://typesense-app-autoscaling-lb-290518720.us-west-2.elb.amazonaws.com/collections/products2/documents/search?${searchParams.toString()}`, requestOptions)

					const data = await response.json();

					return data;
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
