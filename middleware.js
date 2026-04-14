import { NextResponse } from 'next/server';

// Extremely basic in-memory pseudo-rate-limiting for Edge deployments.
// Note: In Vercel Edge, memory is NOT shared across functions or regions out of the box,
// but returning 429 based on this isolated map will still throttle basic high-volume spam per edge node.
const rateLimitCache = new Map();
const MAX_REQUESTS = 60; // Max requests per window 
const WINDOW_MS = 60 * 1000; // 1 minute window

export function middleware(req) {
    const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
    
    // Only rate limit API calls or Auth actions, static HTML is cached heavily by Vercel CDN anyway.
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api') || url.pathname.includes('auth')) {
        const now = Date.now();
        
        let userData = rateLimitCache.get(ip);
        if (!userData) {
            rateLimitCache.set(ip, { requests: [now] });
            return NextResponse.next();
        }

        // Clean old requests outside window
        userData.requests = userData.requests.filter(t => now - t < WINDOW_MS);
        
        if (userData.requests.length >= MAX_REQUESTS) {
            return new NextResponse(
                JSON.stringify({ error: 'Global Rate limit exceeded. Please wait a minute before trying again.' }),
                { status: 429, headers: { 'Content-Type': 'application/json' } }
            );
        }

        userData.requests.push(now);
        rateLimitCache.set(ip, userData);
    }
    
    return NextResponse.next();
}

export const config = {
    // Only run middleware on sensitive endpoints or API
    matcher: ['/api/:path*', '/auth/:path*', '/login.html', '/onboarding.html']
};