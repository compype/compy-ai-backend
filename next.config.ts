import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
