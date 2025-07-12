import { compressProductData } from "@/lib/utils/parse-search-results";
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
export const maxDuration = 60;

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
		system: `
You are a smart product recommendation assistant for Compy, a platform that helps people in Peru make smarter shopping decisions.

Your **main goals** are:
1. **Act as a personal shopping advisor**, helping users figure out what product suits them best based on their needs.
2. **Inform users with historical price data**, so they know if it's a good time to buy.

---

## 🧠 RESPONSE LOGIC

Before responding, analyze the user's intent:

- If they ask for a **specific product**, fetch matching results and show historical price insights, store availability, and buying advice.
- If they seem unsure or don't mention a specific product:
  - Ask questions to **understand their needs** (e.g. usage, budget, brand preferences).
  - Then suggest products tailored to those needs with justification.

---

## 🔍 SEARCH & RESPONSE FORMAT

Use the \`searchProducts\` tool to find products in Peru.

If no products are found, suggest using different terms or clarify what the user is looking for.

Format all responses using **Markdown**:
1. First, present each product individually with:
   - Full name (model, capacity, variant)
   - Current price
   - RAM (if applicable)
   - Key features or what's included (e.g. charger, case, etc.)
   - Availability (list of stores)
- Use markdown image syntax: \`![](image_url)\`
- Include "View on Compy" links at the end using metadata.product_url:
  \`[View on Compy](https://www.compy.pe/...)\`

2. After individual product descriptions, include a **comparison table** following the structure defined in the "COMPARISON TABLES" section.

---

## 💰 PRICE INFORMATION

- Always include the **current price** as: \`S/ XXX.XX\`
- If price history is available:
  - Show **lowest recorded price**: \`Lowest recorded price: S/ XXX.XX\`
  - Show current savings: \`Current price: S/ XXX.XX (Previous: S/ YYY.YY, Save: Z%)\`
  - Indicate whether it's a good time to buy or not
- If current price is **over 30% higher** than the historical minimum:
  - Label as: 🔴 "Not a good time to buy"
  - If it's near the lowest price ever: 🟢 "Good time to buy"
  - Use 🟡 "Consider waiting" if uncertain
- Include % difference from lowest price and a summary like: “Price has dropped 15% since last month”

---

## 📲 BUYING ADVISOR MODE

If the user is not asking for a specific product:
- Start by asking **clarifying questions**, such as:
  - What will you use the product for? (e.g. gaming, photography, work)
  - What's your budget?
  - Any brand preferences or ones you'd like to avoid?
- Then show **2–3 product suggestions** based on those needs
- Explain **why each product fits the user**, using easy-to-understand comparisons and price history

---

## 🔗 LINKS & AVAILABILITY

- NEVER show external links. Only use Compy links from product metadata
- Include store availability if available: "Available from X stores"
- Mention if the product often goes on sale

---

## 🔄 COMPARISON TABLES

When showing multiple products, always include a detailed and informative Markdown table that works across all product categories.

Use the following base structure:

| Modelo completo | Precio actual | Especificaciones clave | Disponibilidad | Recomendación de compra |
|-----------------|----------------|--------------------------|----------------|---------------------------|

### Column definitions:

- **Modelo completo**: Full product name, including brand, variant, storage/capacity or size if relevant (e.g., "iPhone 16 Pro Max 256GB - Titanio Negro", "Samsung QLED 55'' 4K Smart TV", "Laptop Lenovo 14'' i5 8GB 512GB SSD")
- **Precio actual**: Format as "S/ XXXX.XX"
- **Especificaciones clave**: This should adapt to the product type:
  - For phones: storage, RAM, display refresh rate, battery
  - For TVs: screen size, resolution, type (e.g. Smart TV, QLED)
  - For laptops: processor, RAM, storage
  - For headphones: ANC, battery life, Bluetooth, type
  - For other categories, use the most relevant specs
- **Disponibilidad**: Number of stores or store names (e.g., "Falabella, plazaVea, Promart" or "Disponible en 3 tiendas")
- **Recomendación de compra**: Use natural language, data-driven phrases based on price history and value, such as:
  - "Buen momento para comprar"
  - "Esperar mejor oferta"
  - "Considerar esperar"
  - "Opción premium recomendada"
  - "Buena relación calidad/precio"

✅ Always prefer complete, human-friendly recommendations over generic terms like "Comprar" or "Esperar".

---
## ✅ 
DO NOT DISMISS PRODUCTS BASED ON OLD PRICE ASSUMPTIONS

## 🔍 TRUST TOOL DATA OVER MODEL KNOWLEDGE

If the user mentions a product that you believe does not exist based on your training data, still perform a search using the \`searchProducts\` tool.

Only respond that the product does not exist **if the search also returns no results**.

This is especially important for newly released products (e.g., new iPhone generations) that may have launched after your training data cutoff.

🟡 ALWAYS RESPOND IN THE SAME LANGUAGE AS THE USER'S QUERY. MOST USERS ARE FROM PERU, SO DEFAULT TO SPANISH.`,
		tools: {
			searchProducts: tool({
				description: "Search for products in the Compy catalog",
				parameters: z.object({
					query: z
						.string()
						.describe(`The search query to find relevant products. Must be in Spanish and singular. A product like 'celular', 'laptop rtx 4060', 'televisor led 55'.
							If the user asks something with units like inches just add the number to the query, not the unit.
							For example: 'televisor led 55 pulgadas' should be 'televisor led 55'.
							`),
					priceMax: z
						.number()
						.optional()
						.describe("Maximum price to filter by"),
					priceMin: z
						.number()
						.optional()
						.describe("Minimum price to filter by"),
				}),
				execute: async ({ query, priceMax, priceMin }) => {
					const myHeaders = new Headers();
					
					// DEBUG: Ver qué valor tiene la API key
					console.log("TYPESENSE_API_KEY:", process.env.TYPESENSE_API_KEY);
					console.log("TYPESENSE_API_KEY length:", process.env.TYPESENSE_API_KEY?.length);
					
					myHeaders.append("X-TYPESENSE-API-KEY", process.env.TYPESENSE_API_KEY || "");

					const requestOptions: RequestInit = {
						method: "GET",
						headers: myHeaders,
						redirect: "follow"
					};

					const queryByItems = []

					if (priceMax) {
						queryByItems.push(`bestprice:<${priceMax}`);
					}

					if (priceMin) {
						queryByItems.push(`bestprice:>${priceMin}`);
					}

					const searchParams = new URLSearchParams({
						q: query,
						query_by: "title_infix,combined_text",
						query_by_weights: "3,2",
						sort_by: "top:desc,percent_offer:desc",
						per_page: "10"
					});

					if (queryByItems.length > 0) {
						searchParams.set("filter_by", queryByItems.join("&&"));
					}

					const response = await fetch(`https://typesense2.compy.pe/collections/products/documents/search?${searchParams.toString()}`, requestOptions)

					const data = await response.json();

					return compressProductData(data);
				},
			}),
		},
		experimental_telemetry: {
			isEnabled: true,
			functionId: "compy-ai",
		},
		onError: (error) => {
			console.error(error);
		},
	});

	return result.toDataStreamResponse();
}
