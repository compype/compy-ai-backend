import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowedOrigins = [
	"http://localhost:5173",
	"https://compy.cueva.io",
	"https://dev.compy.pe",
	"https://compy.pe",
];

export function middleware(request: NextRequest) {
	// Get the origin from the request headers
	const origin = request.headers.get("origin") || "";

	// Check if the origin is in our allowed origins
	const isAllowedOrigin = allowedOrigins.includes(origin);

	// Handle preflight requests
	if (request.method === "OPTIONS") {
		return new NextResponse(null, {
			status: 204,
			headers: {
				"Access-Control-Allow-Origin": isAllowedOrigin ? origin : allowedOrigins[0],
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
				"Access-Control-Max-Age": "86400",
				"Access-Control-Allow-Credentials": "true",
			},
		});
	}

	// Handle actual requests
	const response = NextResponse.next();

	if (isAllowedOrigin) {
		response.headers.set("Access-Control-Allow-Origin", origin);
		response.headers.set("Access-Control-Allow-Credentials", "true");
	}

	return response;
}

// Configure the middleware to run only on API routes
export const config = {
	matcher: [
		"/api/:path*",
		"/((?!_next/static|_next/image|favicon.ico).*)",
	],
};
