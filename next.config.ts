import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	async headers() {
		return [
			{
				// Apply these headers to all routes
				source: "/api/:path*",
				headers: [
					{
						key: "Access-Control-Allow-Methods",
						value: "GET, POST, PUT, DELETE, OPTIONS",
					},
					{
						key: "Access-Control-Allow-Headers",
						value: "Content-Type, Authorization",
					},
				],
			},
		];
	},
	async rewrites() {
		return {
			beforeFiles: [
				{
					source: "/api/:path*",
					has: [
						{
							type: "header",
							key: "origin",
						},
					],
					destination: "/api/:path*",
				},
			],
		};
	},
};

export default nextConfig;
