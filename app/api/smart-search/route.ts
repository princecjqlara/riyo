import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const LLAMA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

interface Product {
    id: string;
    name: string;
    brand: string | null;
    description: string | null;
    category_id: string | null;
    price: number;
    image_url: string | null;
    product_code: string | null;
}

/**
 * AI-Powered Smart Search API
 * Handles typos, Tagalog queries, and semantic matching
 */
export async function POST(request: NextRequest) {
    try {
        const { query } = await request.json();

        if (!query || query.length < 2) {
            return NextResponse.json({ results: [], correctedQuery: null });
        }

        const supabase = createClient();

        // Fetch all products for matching
        const { data } = await supabase
            .from('items')
            .select('id, name, brand, description, category_id, price, image_url, product_code')
            .order('scan_count', { ascending: false })
            .limit(100);

        const products: Product[] = (data as Product[]) || [];

        if (products.length === 0) {
            return NextResponse.json({ results: [], correctedQuery: null });
        }

        // Create product catalog for AI
        const catalog = products.map((p: Product) =>
            `[${p.id}] ${p.name} | ${p.brand || ''} | ${p.product_code || ''} | ₱${p.price}`
        ).join('\n');

        // Use AI to understand and match the query
        const payload = {
            model: 'meta/llama-3.2-3b-instruct',
            messages: [
                {
                    role: 'system',
                    content: `You are a product search assistant for a Filipino retail store. You understand:
- Tagalog, Taglish, and English
- Common misspellings and typos
- Product nicknames and slang

Your job is to match user queries to products in the catalog. Return ONLY matching product IDs.

IMPORTANT: Respond ONLY with a JSON object in this exact format:
{"matches": ["id1", "id2"], "corrected": "corrected query if any typos"}

If no matches, return: {"matches": [], "corrected": null}`
                },
                {
                    role: 'user',
                    content: `CATALOG:\n${catalog}\n\nUSER SEARCH: "${query}"\n\nFind matching products. Return JSON only.`
                }
            ],
            max_tokens: 200,
            temperature: 0.1,
            stream: false
        };

        const response = await fetch(LLAMA_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NVIDIA_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            // Fallback to simple search if AI fails
            const q = query.toLowerCase();
            const results = products.filter((p: Product) =>
                p.name?.toLowerCase().includes(q) ||
                p.brand?.toLowerCase().includes(q) ||
                p.product_code?.toLowerCase().includes(q)
            ).slice(0, 10);
            return NextResponse.json({ results, correctedQuery: null });
        }

        const responseData = await response.json();
        const content = responseData.choices?.[0]?.message?.content || '';

        // Parse AI response
        let matchedIds: string[] = [];
        let correctedQuery: string | null = null;

        try {
            // Try to extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                matchedIds = parsed.matches || [];
                correctedQuery = parsed.corrected || null;
            }
        } catch {
            // If JSON parse fails, try to extract IDs manually
            const idMatches = content.match(/[a-f0-9-]{36}/gi);
            if (idMatches) matchedIds = idMatches;
        }

        // Get matched products in order
        const results = matchedIds
            .map((id: string) => products.find((p: Product) => p.id === id))
            .filter(Boolean)
            .slice(0, 10);

        // If AI found nothing, fall back to fuzzy local search
        if (results.length === 0) {
            const q = query.toLowerCase();
            const fallbackResults = products.filter((p: Product) =>
                p.name?.toLowerCase().includes(q) ||
                p.brand?.toLowerCase().includes(q) ||
                p.product_code?.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q)
            ).slice(0, 10);
            return NextResponse.json({ results: fallbackResults, correctedQuery: null });
        }

        return NextResponse.json({ results, correctedQuery });
    } catch (error) {
        console.error('Smart search error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
