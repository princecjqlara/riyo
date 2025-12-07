const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const LLAMA_VISION_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

interface ProductAnalysis {
    name: string;
    brand: string | null;
    category: string | null;
    subcategory: string | null;
    description: string;
    features: string[];
    colors: string[];
    size: string | null;
    material: string | null;
    specifications: Record<string, string>;
    suggestedPrice: number | null;
    rawResponse: string;
}

/**
 * Enhanced product analysis with detailed specs and auto-categorization
 */
export async function analyzeProductImage(imageBase64: string): Promise<ProductAnalysis> {
    if (!NVIDIA_API_KEY) {
        throw new Error('Vision API not configured: set NVIDIA_API_KEY in env.');
    }

    let cleanBase64 = imageBase64;
    let mimeType = 'image/jpeg';

    if (imageBase64.startsWith('data:')) {
        const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
            mimeType = match[1];
            cleanBase64 = match[2];
        } else {
            cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        }
    }

    console.log('=== ENHANCED VISION ANALYSIS ===');

    const payload = {
        model: 'meta/llama-3.2-90b-vision-instruct',
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `You are an expert product analyst. Analyze this product image with maximum detail and completeness.

EXTRACT ALL VISIBLE INFORMATION:

1. PRODUCT NAME: Specific name (e.g., "Nike Air Max 270 Running Shoes" not just "shoes")
2. BRAND: Look for logos, text, labels. Say "Unknown" if not visible
3. CATEGORY: Main category (Electronics, Clothing, Food & Beverage, Home & Living, Beauty, Sports, Toys, Office, Automotive, etc.)
4. SUBCATEGORY: Specific subcategory (e.g., "Smartphones" under Electronics, "T-Shirts" under Clothing)
5. COLORS: All colors visible (primary and accent)
6. SIZES: Any size/dimension info (S/M/L, cm, inches, ml, oz)
7. MATERIAL: What it's made of (cotton, plastic, metal, glass, leather, etc.)
8. WEIGHT: If visible or estimable
9. MODEL NUMBER: Any model/SKU numbers visible
10. CONDITION: New, used, sealed, packaging visible?
11. SPECIAL FEATURES: Unique selling points, tech specs, functions, compatibility, included accessories
12. CONTENTS/PACKAGING: What is included in the box/bundle, packaging type
13. TARGET USER / USE-CASES: Who it's for (kids/adults/pro use) and primary use (e.g., cooking rice, gaming)
14. SAFETY / WARNINGS / EXPIRY: Any caution text, expiry/best-before if visible
15. ORIGIN/MADE IN: If visible
16. PRICE ESTIMATE: Estimated retail price in Philippine Peso (₱)

RESPOND IN THIS EXACT FORMAT:
PRODUCT: [exact product name]
BRAND: [brand name]
CATEGORY: [main category]
SUBCATEGORY: [specific subcategory]
COLORS: [comma-separated]
SIZE: [size info]
MATERIAL: [material]
WEIGHT: [weight if known]
MODEL: [model number or N/A]
CONDITION: [new/used/sealed]
FEATURES: [comma-separated key features, include functions, accessories, packaging details]
PRICE_ESTIMATE: [number only, e.g., 500]
DESCRIPTION: [detailed 4-6 sentence description including use-cases, audience, packaging/contents, warnings if any]
SPECS: [key=value pairs separated by semicolons, e.g., Screen=6.5 inches; Battery=5000mAh; RAM=8GB; Origin=Philippines; Expiry=Dec 2025]

Be thorough and accurate. Report only what you can see or reasonably infer.`
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:${mimeType};base64,${cleanBase64}`
                        }
                    }
                ]
            }
        ],
        max_tokens: 1500,
        temperature: 0.1,
        stream: false
    };

    const response = await fetch(LLAMA_VISION_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    if (!response.ok) {
        throw new Error(`Vision API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const content = data.choices?.[0]?.message?.content || '';
    console.log('Enhanced AI Response:', content);

    // Parse structured response
    const getValue = (key: string): string | null => {
        const regex = new RegExp(`${key}:\\s*(.+)`, 'i');
        const match = content.match(regex);
        const val = match?.[1]?.trim();
        return val && val.toLowerCase() !== 'n/a' && val.toLowerCase() !== 'unknown' ? val : null;
    };

    const colors = getValue('COLORS')?.split(',').map(c => c.trim().toLowerCase()).filter(Boolean) || [];
    const features = getValue('FEATURES')?.split(',').map(f => f.trim()).filter(Boolean) || [];

    // Parse specifications
    const specsStr = getValue('SPECS') || '';
    const specifications: Record<string, string> = {};
    specsStr.split(';').forEach(pair => {
        const [key, value] = pair.split('=').map(s => s.trim());
        if (key && value) specifications[key] = value;
    });

    // Parse price estimate
    const priceStr = getValue('PRICE_ESTIMATE');
    const suggestedPrice = priceStr ? parseFloat(priceStr.replace(/[^0-9.]/g, '')) || null : null;

    return {
        name: getValue('PRODUCT') || 'Unknown Product',
        brand: getValue('BRAND'),
        category: getValue('CATEGORY'),
        subcategory: getValue('SUBCATEGORY'),
        description: getValue('DESCRIPTION') || content.slice(0, 500),
        features: [...features, ...colors].slice(0, 15),
        colors,
        size: getValue('SIZE'),
        material: getValue('MATERIAL'),
        specifications,
        suggestedPrice,
        rawResponse: content
    };
}

/**
 * Auto-categorize product based on AI analysis
 */
export async function suggestCategory(analysis: ProductAnalysis, existingCategories: { id: string; name: string; parent_id: string | null }[]): Promise<{
    categoryId: string | null;
    newCategory: { name: string; parentId: string | null } | null;
}> {
    // Try to find matching category
    const category = analysis.category?.toLowerCase() || '';
    const subcategory = analysis.subcategory?.toLowerCase() || '';

    // Look for exact match first
    for (const cat of existingCategories) {
        const catName = cat.name.toLowerCase();
        if (catName === category || catName === subcategory) {
            return { categoryId: cat.id, newCategory: null };
        }
    }

    // Look for partial match
    for (const cat of existingCategories) {
        const catName = cat.name.toLowerCase();
        if (category.includes(catName) || catName.includes(category)) {
            return { categoryId: cat.id, newCategory: null };
        }
        if (subcategory && (subcategory.includes(catName) || catName.includes(subcategory))) {
            return { categoryId: cat.id, newCategory: null };
        }
    }

    // Suggest new category
    if (analysis.category) {
        // Find parent category
        let parentId: string | null = null;
        for (const cat of existingCategories) {
            if (cat.name.toLowerCase() === category && !cat.parent_id) {
                parentId = cat.id;
                break;
            }
        }

        // If subcategory should be created
        if (analysis.subcategory && parentId) {
            return {
                categoryId: null,
                newCategory: { name: analysis.subcategory, parentId }
            };
        }

        // Create main category
        return {
            categoryId: null,
            newCategory: { name: analysis.category, parentId: null }
        };
    }

    return { categoryId: null, newCategory: null };
}

/**
 * Stricter product matching
 */
export function matchProductToDatabase(
    analysis: ProductAnalysis,
    products: Array<{
        id: string;
        name: string;
        brand: string | null;
        category: string | null;
        product_code?: string | null;
        distinguishing_features: string[] | null;
        [key: string]: unknown;
    }>
): { product: typeof products[0]; score: number; isExactMatch: boolean } | null {
    if (!products.length) return null;

    const analysisText = [
        analysis.name,
        analysis.brand,
        analysis.category,
        analysis.subcategory,
        analysis.description,
        analysis.material,
        analysis.size,
        ...analysis.features,
        ...analysis.colors,
        ...Object.values(analysis.specifications)
    ].filter(Boolean).join(' ').toLowerCase();

    let bestMatch = null;
    let bestScore = 0;

    for (const product of products) {
        let score = 0;
        let brandMatched = false;
        let nameMatched = false;

        // Brand match
        if (analysis.brand && product.brand) {
            const ab = analysis.brand.toLowerCase();
            const pb = product.brand.toLowerCase();
            if (ab === pb) {
                score += 4;
                brandMatched = true;
            } else if (ab.includes(pb) || pb.includes(ab)) {
                score += 2;
                brandMatched = true;
            }
        }

        // Category match
        if (analysis.category && product.category) {
            if (analysis.category.toLowerCase() === product.category.toLowerCase()) {
                score += 1.5;
            }
        }

        // Name keyword match
        const nameWords = product.name?.toLowerCase().split(/\s+/) || [];
        let nameWordMatches = 0;
        for (const word of nameWords) {
            if (word.length > 2 && analysisText.includes(word)) {
                score += 0.3;
                nameWordMatches++;
            }
        }
        if (nameWordMatches >= 2) nameMatched = true;

        // Feature matches
        const productFeatures = product.distinguishing_features || [];
        for (const feature of productFeatures) {
            if (analysisText.includes(feature.toLowerCase())) {
                score += 0.5;
            }
        }

        // Color/material match
        for (const color of analysis.colors) {
            if (product.name?.toLowerCase().includes(color)) score += 0.3;
        }
        if (analysis.material && product.name?.toLowerCase().includes(analysis.material.toLowerCase())) {
            score += 0.3;
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = {
                product,
                score,
                isExactMatch: brandMatched && (nameMatched || score >= 5)
            };
        }
    }

    return bestMatch && bestScore >= 0.5 ? bestMatch : null;
}

/**
 * Search by image
 */
export async function searchByImage(imageBase64: string, products: Array<{
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    distinguishing_features: string[] | null;
    [key: string]: unknown;
}>): Promise<{
    match: typeof products[0] | null;
    isExactMatch: boolean;
    analysis: ProductAnalysis;
    confidence: number;
}> {
    const analysis = await analyzeProductImage(imageBase64);
    const result = matchProductToDatabase(analysis, products);

    return {
        match: result?.product || null,
        isExactMatch: result?.isExactMatch || false,
        analysis,
        confidence: result?.score || 0
    };
}

/**
 * Search with NVIDIA Grounding DINO for object detection
 * This is a placeholder/stub implementation
 * Full implementation requires NVIDIA API configuration
 */
export async function searchWithDino(
    imageBuffer: Buffer,
    prompt?: string
): Promise<{
    detections: Array<{
        label: string;
        score: number;
        bbox: [number, number, number, number];
    }>;
    processingTime: number;
}> {
    // Stub implementation - returns empty detections
    // TODO: Implement full NVIDIA Grounding DINO integration
    // Requires NVIDIA API key and proper setup
    console.warn('NVIDIA Grounding DINO not fully configured. Returning empty detections.');
    
    return {
        detections: [],
        processingTime: 0
    };
}
