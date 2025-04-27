"use client";

import { useChat } from "@ai-sdk/react";
import type { Message as UIMessage } from "@ai-sdk/react";
import { useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// Add type definitions for the product information
interface Product {
	id: string;
	title: string;
	brand: string;
	model: string;
	price: number | string;
	category: string;
	product_url: string;
	image_url?: string;
	color?: string;
	capacity?: string;
	memory?: string;
	screen_size?: string;
	weight?: string;
	power?: string;
	features_markdown?: string;
	specifications_markdown?: string;
}

interface ChatMessage extends UIMessage {
	toolResults?: Array<{
		result: {
			products: Product[];
		};
	}>;
}

export default function ChatPage() {
	const { messages, input, handleInputChange, handleSubmit, status } = useChat({
		maxSteps: 3, // Allow multi-step tool calls
	});

	// Track expanded product details
	const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
		new Set(),
	);

	// Toggle product details
	const toggleProductDetails = (productId: string) => {
		setExpandedProducts((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(productId)) {
				newSet.delete(productId);
			} else {
				newSet.add(productId);
			}
			return newSet;
		});
	};

	// Custom renderers for markdown components
	const markdownComponents: Components = {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		img: (props: any) => (
			<div className="relative my-2">
				<img
					{...props}
					alt={props.alt || "Product image"}
					className="mx-auto max-h-[300px] rounded-md object-contain"
				/>
			</div>
		),
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		table: (props: any) => (
			<div className="my-4 overflow-x-auto">
				<table
					className="min-w-full divide-y divide-gray-300 rounded-lg border"
					{...props}
				/>
			</div>
		),
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		thead: (props: any) => <thead className="bg-gray-100" {...props} />,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		th: (props: any) => (
			<th
				className="px-3 py-2 text-left font-medium text-gray-700 text-xs uppercase tracking-wider"
				{...props}
			/>
		),
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		td: (props: any) => (
			<td
				className="whitespace-normal border-t px-3 py-2 text-gray-500 text-sm"
				{...props}
			/>
		),
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		tr: (props: any) => <tr className="even:bg-gray-50" {...props} />,
	};
	/* eslint-enable @typescript-eslint/no-explicit-any */

	// Render product cards from tools results
	const renderProductCards = (message: ChatMessage): ReactNode | null => {
		if (
			message.toolResults &&
			message.toolResults[0]?.result?.products?.length > 0
		) {
			const products = message.toolResults[0].result.products;

			return (
				<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
					{products.map((product: Product) => (
						<div
							key={product.id}
							className="overflow-hidden rounded-lg border bg-white shadow transition-shadow hover:shadow-md"
						>
							{/* Product image */}
							{product.image_url && (
								<div className="relative flex h-40 justify-center bg-white p-2">
									<img
										src={product.image_url}
										alt={product.title}
										className="max-h-full object-contain"
									/>
								</div>
							)}

							{/* Product info */}
							<div className="border-t p-3">
								<h3 className="truncate font-medium text-gray-900">
									{product.title}
								</h3>
								<p className="mt-1 font-bold text-blue-600 text-sm">
									S/{" "}
									{typeof product.price === "number"
										? product.price.toFixed(2)
										: product.price}
								</p>
								<p className="text-gray-500 text-xs">
									{product.brand} | {product.model}
								</p>

								{/* Toggle details button */}
								<button
									type="button"
									onClick={() => toggleProductDetails(product.id)}
									className="mt-2 text-blue-500 text-xs hover:underline"
								>
									{expandedProducts.has(product.id)
										? "Hide details"
										: "Show details"}
								</button>

								{/* Expanded details */}
								{expandedProducts.has(product.id) && (
									<div className="mt-2 text-gray-700 text-xs">
										<p>
											<span className="font-semibold">Category:</span>{" "}
											{product.category}
										</p>

										{/* Base product details */}
										<div className="mb-2">
											{product.color && (
												<p>
													<span className="font-semibold">Color:</span>{" "}
													{product.color}
												</p>
											)}
											{product.capacity && (
												<p>
													<span className="font-semibold">Capacity:</span>{" "}
													{product.capacity}
												</p>
											)}
											{product.memory && (
												<p>
													<span className="font-semibold">Memory:</span>{" "}
													{product.memory}
												</p>
											)}
											{product.screen_size && (
												<p>
													<span className="font-semibold">Screen Size:</span>{" "}
													{product.screen_size}
												</p>
											)}
											{product.weight && (
												<p>
													<span className="font-semibold">Weight:</span>{" "}
													{product.weight}
												</p>
											)}
											{product.power && (
												<p>
													<span className="font-semibold">Power:</span>{" "}
													{product.power}
												</p>
											)}
										</div>

										{/* Render specifications and features as markdown */}
										{(product.specifications_markdown ||
											product.features_markdown) && (
											<div className="prose prose-sm mt-3 max-w-none">
												{product.specifications_markdown && (
													<ReactMarkdown
														remarkPlugins={[remarkGfm]}
														rehypePlugins={[rehypeRaw, rehypeSanitize]}
														components={markdownComponents}
													>
														{product.specifications_markdown}
													</ReactMarkdown>
												)}

												{product.features_markdown && (
													<ReactMarkdown
														remarkPlugins={[remarkGfm]}
														rehypePlugins={[rehypeRaw, rehypeSanitize]}
														components={markdownComponents}
													>
														{product.features_markdown}
													</ReactMarkdown>
												)}
											</div>
										)}

										<a
											href={product.product_url}
											target="_blank"
											rel="noopener noreferrer"
											className="mt-2 block text-blue-500 hover:underline"
										>
											View on Compy →
										</a>
									</div>
								)}
							</div>
						</div>
					))}
				</div>
			);
		}
		return null;
	};

	return (
		<div className="mx-auto flex h-[90vh] w-full max-w-4xl flex-col p-4">
			<h1 className="mb-4 font-bold text-xl">Compy Product Assistant</h1>

			<div className="mb-4 flex-1 space-y-4 overflow-y-auto rounded-lg border p-4">
				{messages.length === 0 && (
					<div className="py-12 text-center text-gray-500">
						<p>Ask me about products! For example:</p>
						<ul className="mt-2 space-y-1 text-sm">
							<li>"Find me a Samsung TV"</li>
							<li>"What's the best washing machine under S/1000?"</li>
							<li>"Show me refrigerators from Indurama"</li>
						</ul>
					</div>
				)}

				{messages.map((message: ChatMessage) => (
					<div
						key={message.id}
						className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
					>
						<div
							className={`max-w-[85%] rounded-lg p-3 ${
								message.role === "user"
									? "bg-blue-500 text-white"
									: "bg-gray-200 text-black"
							}`}
						>
							{message.content ? (
								<div className="prose prose-sm max-w-none">
									<ReactMarkdown
										remarkPlugins={[remarkGfm]}
										rehypePlugins={[rehypeRaw, rehypeSanitize]}
										components={markdownComponents}
									>
										{message.content}
									</ReactMarkdown>
								</div>
							) : (
								<div className="text-sm italic opacity-70">
									Searching for products...
								</div>
							)}

							{/* Display product cards if available */}
							{message.role === "assistant" && renderProductCards(message)}
						</div>
					</div>
				))}

				{status === "streaming" &&
					messages[messages.length - 1]?.role !== "assistant" && (
						<div className="flex justify-start">
							<div className="max-w-[80%] rounded-lg bg-gray-200 p-3">
								<div className="flex animate-pulse space-x-2">
									<div className="h-2 w-2 rounded-full bg-gray-500" />
									<div className="h-2 w-2 rounded-full bg-gray-500" />
									<div className="h-2 w-2 rounded-full bg-gray-500" />
								</div>
							</div>
						</div>
					)}
			</div>

			<form onSubmit={handleSubmit} className="flex gap-2">
				<input
					type="text"
					value={input}
					onChange={handleInputChange}
					placeholder="Ask about products..."
					className="flex-1 rounded-md border p-2"
				/>
				<button
					type="submit"
					disabled={status === "streaming" || !input.trim()}
					className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
				>
					Send
				</button>
			</form>
		</div>
	);
}
