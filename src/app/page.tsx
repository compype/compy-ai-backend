"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChat } from "@ai-sdk/react";
import type { Message as UIMessage } from "@ai-sdk/react";
import {
	ChevronRight,
	ExternalLink,
	Send,
	Sparkles,
	Square,
} from "lucide-react";
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
	view_product_link?: string;
}

interface ChatMessage extends UIMessage {
	toolResults?: Array<{
		result: {
			products: Product[];
		};
	}>;
}

// Add a new Suggestion component before the main ChatPage component
interface SuggestionProps {
	text: string;
	onClick: (text: string) => void;
}

function Suggestion({ text, onClick }: Readonly<SuggestionProps>) {
	return (
		<button
			type="button"
			onClick={() => onClick(text)}
			className="flex w-full items-center rounded-lg border bg-background p-3 text-left text-sm shadow-sm transition-colors hover:bg-muted/50"
		>
			<span className="flex-1">{text}</span>
			<ChevronRight className="h-4 w-4 text-muted-foreground" />
		</button>
	);
}

export default function ChatPage() {
	const {
		messages,
		input,
		handleInputChange,
		handleSubmit,
		status,
		stop,
		error,
	} = useChat({
		maxSteps: 3, // Allow multi-step tool calls
	});

	// Function to handle suggestion clicks
	const handleSuggestionClick = (text: string) => {
		handleInputChange({
			target: { value: text },
		} as React.ChangeEvent<HTMLInputElement>);
	};

	// Check if the error is a rate limit error (HTTP 429)
	const isRateLimitError =
		error && /429|too many requests/i.test(String(error.message || ""));

	// Get retry time from error response if available
	const getRetrySeconds = () => {
		if (!error) return 60; // Default to 60 seconds

		try {
			// Try to extract resetSeconds from error message if it's JSON
			if (
				typeof error.message === "string" &&
				error.message.includes("resetSeconds")
			) {
				const match = RegExp(/"resetSeconds":(\d+)/).exec(error.message);
				if (match?.[1]) {
					return Number.parseInt(match[1], 10);
				}
			}

			// Fallback to using reset timestamp if available
			if (
				typeof error.message === "string" &&
				error.message.includes("reset")
			) {
				const match = RegExp(/"reset":"([^"]+)"/).exec(error.message);
				if (match?.[1]) {
					const resetTime = new Date(match[1]).getTime();
					const now = Date.now();
					return Math.max(1, Math.ceil((resetTime - now) / 1000));
				}
			}
		} catch (e) {
			console.error(e);
		}

		return 60; // Default fallback
	};

	// Format the wait time message
	const formatRateLimitMessage = () => {
		const seconds = getRetrySeconds();
		return `Please try again in ${seconds} second${seconds !== 1 ? "s" : ""}.`;
	};

	// Custom renderers for markdown components
	const markdownComponents: Components = {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		img: (props: any) => (
			<img
				{...props}
				alt={props.alt ?? "Product image"}
				className="relative mx-auto my-2 max-h-[300px] rounded-md object-contain"
			/>
		),
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		table: (props: any) => (
			<table
				className="my-4 min-w-full divide-y divide-gray-300 overflow-x-auto rounded-lg border"
				{...props}
			/>
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
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		a: (props: any) => {
			// Check if this is a "View Product" link
			const isViewProductLink = props.href.includes(
				"compy.pe/galeria/producto",
			);

			if (isViewProductLink) {
				return (
					<Button variant="outline" size="sm" asChild className="mt-3 w-full">
						<a
							{...props}
							className="flex items-center justify-center gap-2"
							target="_blank"
							rel="noopener noreferrer"
						>
							{props.children}
							<ExternalLink size={14} />
						</a>
					</Button>
				);
			}

			// Default styling for other links
			return (
				<a
					{...props}
					className="text-blue-600 hover:underline focus:outline-none"
				/>
			);
		},
	};
	/* eslint-enable @typescript-eslint/no-explicit-any */

	return (
		<div className="mx-auto flex h-[90vh] w-full max-w-5xl flex-col p-6">
			<h1 className="mb-6 font-bold text-2xl">Compy AI</h1>

			<div className="mb-6 flex-1 space-y-4 overflow-y-auto rounded-lg border bg-gray-50 p-6 shadow-sm">
				{messages.length === 0 && (
					<div className="flex h-full flex-col items-center justify-center gap-3">
						<div className="flex items-center gap-2 text-gray-400">
							<Sparkles className="h-8 w-8" />
							<span className="text-2xl">Compy AI</span>
						</div>
					</div>
				)}

				{messages.map((message: ChatMessage) => (
					<div
						key={message.id}
						className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
					>
						<div
							className={`max-w-[85%] rounded-lg p-4 shadow-sm ${
								message.role === "user"
									? "bg-blue-600 text-white"
									: "bg-white text-black"
							}`}
						>
							{message.content ? (
								<div className="prose prose-sm max-w-none overflow-x-auto">
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
									Buscando productos...
								</div>
							)}
						</div>
					</div>
				))}

				{status === "streaming" &&
					messages[messages.length - 1]?.role !== "assistant" && (
						<div className="flex justify-start">
							<div className="max-w-[80%] rounded-lg bg-white p-4 shadow-sm">
								<div className="flex animate-pulse space-x-2">
									<div className="h-2 w-2 rounded-full bg-gray-500" />
									<div className="h-2 w-2 rounded-full bg-gray-500" />
									<div className="h-2 w-2 rounded-full bg-gray-500" />
								</div>
							</div>
						</div>
					)}
			</div>

			<div className="space-y-4">
				{/* ChatGPT-style suggestions */}
				{messages.length === 0 && (
					<div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
						<Suggestion
							text="Smartphones de gama media por menos de 800 soles"
							onClick={handleSuggestionClick}
						/>
						<Suggestion
							text="Televisores LG de 60 pulgadas"
							onClick={handleSuggestionClick}
						/>
						<Suggestion
							text="Televisores OLED de 55 pulgadas"
							onClick={handleSuggestionClick}
						/>
						<Suggestion
							text="iPhone 12 o 13 por menos de 2000 soles"
							onClick={handleSuggestionClick}
						/>
					</div>
				)}

				<form onSubmit={handleSubmit} className="relative">
					<Textarea
						value={input}
						onChange={handleInputChange}
						placeholder="Pregunta sobre productos..."
						className="max-h-[120px] min-h-[50px] flex-1 resize-none rounded-lg pr-12"
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSubmit(e as unknown as React.FormEvent);
							}
						}}
					/>
					<div className="absolute right-2 bottom-2">
						{status === "streaming" ? (
							<Button
								type="button"
								size="icon"
								variant="ghost"
								onClick={stop}
								className="h-8 w-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
							>
								<Square className="h-4 w-4" />
							</Button>
						) : (
							<Button
								type="submit"
								size="icon"
								disabled={!input.trim()}
								className="h-8 w-8 rounded-full bg-blue-600 text-white hover:bg-blue-700"
							>
								<Send className="h-4 w-4" />
							</Button>
						)}
					</div>
				</form>

				{/* Rate limit error notification */}
				{isRateLimitError && (
					<div className="mt-2 rounded-md bg-red-50 p-3 text-red-600 shadow-sm">
						<div className="flex items-center gap-2 font-medium">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<circle cx="12" cy="12" r="10" />
								<line x1="12" y1="8" x2="12" y2="12" />
								<line x1="12" y1="16" x2="12.01" y2="16" />
							</svg>
							Rate limit exceeded
						</div>
						<p className="mt-1 text-sm">
							You've reached the maximum number of requests allowed.{" "}
							{formatRateLimitMessage()}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
