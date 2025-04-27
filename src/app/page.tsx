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

function Suggestion({ text, onClick }: SuggestionProps) {
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
	const { messages, input, handleInputChange, handleSubmit, status, stop } =
		useChat({
			maxSteps: 3, // Allow multi-step tool calls
		});

	// Function to handle suggestion clicks
	const handleSuggestionClick = (text: string) => {
		handleInputChange({
			target: { value: text },
		} as React.ChangeEvent<HTMLInputElement>);
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
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		a: (props: any) => {
			console.log(props);
			// Check if this is a "View Product" link
			const isViewProductLink = props.href.startsWith(
				"https://compy.pe/galeria/producto/",
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
							text="Lavadoras para solteros por menos de 800 soles"
							onClick={handleSuggestionClick}
						/>
						<Suggestion
							text="Refrigeradores economicos"
							onClick={handleSuggestionClick}
						/>
						<Suggestion
							text="Televisores de 32 pulgadas"
							onClick={handleSuggestionClick}
						/>
						<Suggestion
							text="Aspiradoras baratas"
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
			</div>
		</div>
	);
}
