import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface WholesaleTier {
    min_qty: number;
    price: number;
    label: string;
}

// Get or create cart
async function getOrCreateCart(supabase: ReturnType<typeof getSupabase>, sessionId: string) {
    let { data: cart } = await supabase
        .from('carts')
        .select('*')
        .eq('session_id', sessionId)
        .single();

    if (!cart) {
        const { data: newCart } = await supabase
            .from('carts')
            .insert({ session_id: sessionId })
            .select()
            .single();
        cart = newCart;
    }
    return cart;
}

// Calculate best price for quantity
function getBestPrice(retailPrice: number, wholesaleTiers: WholesaleTier[], quantity: number, sizePrice?: number): { price: number; isWholesale: boolean; tierLabel: string | null; discount: number } {
    // If size price is provided, use it as the base. 
    // For MVP, we apply wholesale logic ONLY if tiers are present, but usually tiers are absolute prices.
    // If sizePrice is different from retailPrice, tiers might be invalid.
    // Strategy: If sizePrice exists, use it. If quantity hits a tier, use tier price ONLY IF it's lower than sizePrice.

    let currentPrice = sizePrice || retailPrice;
    let isWholesale = false;
    let tierLabel = null;

    // Sort tiers DESC
    const sortedTiers = [...wholesaleTiers].sort((a, b) => b.min_qty - a.min_qty);

    for (const tier of sortedTiers) {
        if (quantity >= tier.min_qty) {
            // Only apply wholesale tier if it offers a discount on the CURRENT price (size or retail)
            if (tier.price < currentPrice) {
                currentPrice = tier.price;
                isWholesale = true;
                tierLabel = tier.label || `${tier.min_qty}+ pcs`;
            }
            break; // Took the best tier
        }
    }

    // Discount calculated against the BASE Retail Price (product.price) or Size Price?
    // User saves money compared to buying individual units at the configured price.
    const baseUnit = sizePrice || retailPrice;
    const discount = (baseUnit - currentPrice) * quantity;

    return { price: currentPrice, isWholesale, tierLabel, discount };
}

// GET - Get cart with items
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session');

        if (!sessionId) {
            return NextResponse.json({ error: 'Session required' }, { status: 400 });
        }

        const supabase = getSupabase();
        const cart = await getOrCreateCart(supabase, sessionId);
        if (!cart) {
            return NextResponse.json({ items: [], total: 0, discount: 0 });
        }

        // Get cart items with product details AND size
        const { data: items } = await supabase
            .from('cart_items')
            .select(`
        id,
        quantity,
        unit_price,
        is_wholesale,
        tier_label,
        size,
        product:items(id, name, price, brand, image_url, additional_images, wholesale_tiers, quantity as stock, sizes)
      `)
            .eq('cart_id', cart.id);

        // Recalculate prices based on current quantities
        let total = 0;
        let totalDiscount = 0;

        const enrichedItems = (items || []).map((item: any) => {
            const product = item.product;

            // Find size price if size exists
            let sizePrice = undefined;
            if (item.size && product.sizes && Array.isArray(product.sizes)) {
                const s = product.sizes.find((s: any) => s.size === item.size);
                if (s) sizePrice = s.price;
            }

            const pricing = getBestPrice(
                product.price,
                (product.wholesale_tiers || []) as WholesaleTier[],
                item.quantity,
                sizePrice
            );

            const subtotal = pricing.price * item.quantity;
            total += subtotal;
            totalDiscount += pricing.discount;

            return {
                ...item,
                unit_price: pricing.price,
                is_wholesale: pricing.isWholesale,
                tier_label: pricing.tierLabel,
                retail_price: sizePrice || product.price,
                subtotal,
                discount: pricing.discount
            };
        });

        return NextResponse.json({
            cart_id: cart.id,
            items: enrichedItems,
            total,
            total_discount: totalDiscount,
            item_count: enrichedItems.reduce((sum: number, i: { quantity: number }) => sum + i.quantity, 0)
        });

    } catch (error) {
        console.error('Cart error:', error);
        return NextResponse.json({ error: 'Failed to get cart' }, { status: 500 });
    }
}

// POST - Add item to cart
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, productId, quantity = 1, size } = body;

        if (!sessionId || !productId) {
            return NextResponse.json({ error: 'Session and product required' }, { status: 400 });
        }

        const supabase = getSupabase();
        const cart = await getOrCreateCart(supabase, sessionId);

        // Get product
        const { data: product } = await supabase
            .from('items')
            .select('*')
            .eq('id', productId)
            .single();

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Determine Base Price (Size price or Product price)
        let sizePrice = undefined;
        if (size && product.sizes && Array.isArray(product.sizes)) {
            const s = product.sizes.find((s: any) => s.size === size);
            if (s) sizePrice = s.price;
        }

        // Check if item exists in cart (Product + Size)
        let query = supabase
            .from('cart_items')
            .select('*')
            .eq('cart_id', cart.id)
            .eq('product_id', productId);

        if (size) {
            query = query.eq('size', size);
        } else {
            query = query.is('size', null);
        }

        const { data: existingItem, error: existingError } = await query.maybeSingle();
        if (existingError && existingError.code !== 'PGRST116') {
            console.error('Cart lookup error:', existingError);
            return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
        }

        const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;
        const basePrice = Number(product.price ?? 0) || 0;
        const pricing = getBestPrice(basePrice, product.wholesale_tiers || [], newQuantity, sizePrice);

        if (existingItem) {
            // Update quantity
            const { error: updateError } = await supabase
                .from('cart_items')
                .update({
                    quantity: newQuantity,
                    unit_price: pricing.price,
                    is_wholesale: pricing.isWholesale,
                    tier_label: pricing.tierLabel,
                    size: size || null
                })
                .eq('id', existingItem.id);
            if (updateError) throw updateError;
        } else {
            // Insert new item
            const { error: insertError } = await supabase
                .from('cart_items')
                .insert({
                    cart_id: cart.id,
                    product_id: productId,
                    quantity: newQuantity,
                    unit_price: pricing.price,
                    is_wholesale: pricing.isWholesale,
                    tier_label: pricing.tierLabel,
                    size: size || null
                });

            // If unique constraint (cart_id, product_id) blocks size variants, merge into existing row
            if (insertError) {
                const pgCode = (insertError as { code?: string }).code;
                if (pgCode === '23505') {
                    const { data: fallbackExisting } = await supabase
                        .from('cart_items')
                        .select('*')
                        .eq('cart_id', cart.id)
                        .eq('product_id', productId)
                        .single();

                    if (fallbackExisting) {
                        const mergedQty = fallbackExisting.quantity + quantity;
                        const mergedPricing = getBestPrice(basePrice, product.wholesale_tiers || [], mergedQty, sizePrice);
                        const { error: mergeError } = await supabase
                            .from('cart_items')
                            .update({
                                quantity: mergedQty,
                                unit_price: mergedPricing.price,
                                is_wholesale: mergedPricing.isWholesale,
                                tier_label: mergedPricing.tierLabel,
                                size: size || fallbackExisting.size || null
                            })
                            .eq('id', fallbackExisting.id);
                        if (mergeError) throw mergeError;
                    } else {
                        throw insertError;
                    }
                } else {
                    throw insertError;
                }
            }
        }

        return NextResponse.json({
            success: true,
            quantity: newQuantity,
            is_wholesale: pricing.isWholesale,
            tier_label: pricing.tierLabel,
            discount: pricing.discount
        });

    } catch (error) {
        console.error('Add to cart error:', error);
        return NextResponse.json({ error: 'Failed to add item', detail: (error as Error)?.message || String(error) }, { status: 500 });
    }
}

// PUT - Update item quantity
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, itemId, quantity } = body;

        if (!sessionId || !itemId || quantity === undefined) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const supabase = getSupabase();

        if (quantity <= 0) {
            // Remove item
            await supabase.from('cart_items').delete().eq('id', itemId);
            return NextResponse.json({ success: true, removed: true });
        }

        // Get item with product
        const { data: item } = await supabase
            .from('cart_items')
            .select('*, product:items(*)')
            .eq('id', itemId)
            .single();

        if (!item) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        let sizePrice = undefined;
        if (item.size && item.product.sizes && Array.isArray(item.product.sizes)) {
            const s = item.product.sizes.find((s: any) => s.size === item.size);
            if (s) sizePrice = s.price;
        }

        const pricing = getBestPrice(item.product.price, item.product.wholesale_tiers || [], quantity, sizePrice);

        await supabase
            .from('cart_items')
            .update({
                quantity,
                unit_price: pricing.price,
                is_wholesale: pricing.isWholesale,
                tier_label: pricing.tierLabel
            })
            .eq('id', itemId);

        return NextResponse.json({
            success: true,
            quantity,
            is_wholesale: pricing.isWholesale,
            tier_label: pricing.tierLabel
        });

    } catch (error) {
        console.error('Update cart error:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}

// DELETE - Remove item from cart
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const itemId = searchParams.get('itemId');

        if (!itemId) {
            return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
        }

        await getSupabase().from('cart_items').delete().eq('id', itemId);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete cart item error:', error);
        return NextResponse.json({ error: 'Failed to remove' }, { status: 500 });
    }
}

