import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Generate 6-digit code
function generateCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// POST - Generate transfer code
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { cartId } = body;

        if (!cartId) {
            return NextResponse.json({ error: 'Cart ID required' }, { status: 400 });
        }

        // Check if cart has items
        const { data: items } = await supabase
            .from('cart_items')
            .select('id')
            .eq('cart_id', cartId);

        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
        }

        // Check for existing pending code
        const { data: existing } = await supabase
            .from('transfer_codes')
            .select('*')
            .eq('cart_id', cartId)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .single();

        if (existing) {
            return NextResponse.json({
                code: existing.code,
                expires_at: existing.expires_at,
                existing: true
            });
        }

        // Generate new code (60 minutes expiry)
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        const { data: transfer, error } = await supabase
            .from('transfer_codes')
            .insert({
                code,
                cart_id: cartId,
                expires_at: expiresAt.toISOString(),
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            code: transfer.code,
            expires_at: transfer.expires_at,
            id: transfer.id
        });

    } catch (error) {
        console.error('Transfer code error:', error);
        return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }
}

// GET - Look up transfer code (for staff)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code')?.toUpperCase();

        if (!code) {
            return NextResponse.json({ error: 'Code required' }, { status: 400 });
        }

        // Find transfer code
        const { data: transfer } = await supabase
            .from('transfer_codes')
            .select('*')
            .eq('code', code)
            .single();

        if (!transfer) {
            return NextResponse.json({ error: 'Invalid code' }, { status: 404 });
        }

        // Check expiry
        if (new Date(transfer.expires_at) < new Date()) {
            await supabase
                .from('transfer_codes')
                .update({ status: 'expired' })
                .eq('id', transfer.id);
            return NextResponse.json({ error: 'Code expired' }, { status: 410 });
        }

        if (transfer.status !== 'pending') {
            return NextResponse.json({ error: `Code already ${transfer.status}` }, { status: 400 });
        }

        // Get cart with items
        const { data: items } = await supabase
            .from('cart_items')
            .select(`
        id,
        quantity,
        unit_price,
        is_wholesale,
        tier_label,
        product:items(id, name, price, brand, image_url)
      `)
            .eq('cart_id', transfer.cart_id);

        // Calculate totals
        let total = 0;
        let totalDiscount = 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const enrichedItems = (items || []).map((item: any) => {
            const product = Array.isArray(item.product) ? item.product[0] : item.product;
            const subtotal = item.unit_price * item.quantity;
            const discount = product ? (product.price - item.unit_price) * item.quantity : 0;
            total += subtotal;
            totalDiscount += discount;
            return { ...item, product, subtotal, discount };
        });

        return NextResponse.json({
            transfer_id: transfer.id,
            code: transfer.code,
            status: transfer.status,
            expires_at: transfer.expires_at,
            items: enrichedItems,
            total,
            total_discount: totalDiscount,
            item_count: enrichedItems.reduce((sum: number, i: { quantity: number }) => sum + i.quantity, 0)
        });

    } catch (error) {
        console.error('Lookup error:', error);
        return NextResponse.json({ error: 'Failed to lookup' }, { status: 500 });
    }
}

// PUT - Confirm or cancel transfer (staff action)
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { transferId, action, staffId, paymentMethod } = body;

        if (!transferId || !action) {
            return NextResponse.json({ error: 'Transfer ID and action required' }, { status: 400 });
        }

        // Get transfer
        const { data: transfer } = await supabase
            .from('transfer_codes')
            .select('*')
            .eq('id', transferId)
            .single();

        if (!transfer || transfer.status !== 'pending') {
            return NextResponse.json({ error: 'Invalid or already processed' }, { status: 400 });
        }

        if (action === 'confirm') {
            // Get cart items for order
            const { data: items } = await supabase
                .from('cart_items')
                .select(`
          quantity,
          unit_price,
          is_wholesale,
          tier_label,
          product:items(id, name, price)
        `)
                .eq('cart_id', transfer.cart_id);

            // Calculate total
            let total = 0;
            let totalDiscount = 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (items || []).forEach((item: any) => {
                const product = Array.isArray(item.product) ? item.product[0] : item.product;
                total += item.unit_price * item.quantity;
                totalDiscount += product ? (product.price - item.unit_price) * item.quantity : 0;
            });

            // Create order
            const { data: order } = await supabase
                .from('orders')
                .insert({
                    transfer_code_id: transferId,
                    staff_id: staffId || null,
                    total_amount: total,
                    total_discount: totalDiscount,
                    payment_method: paymentMethod || 'cash',
                    status: 'completed'
                })
                .select()
                .single();

            // Create order items
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const orderItems = (items || []).map((item: any) => {
                const product = Array.isArray(item.product) ? item.product[0] : item.product;
                return {
                    order_id: order.id,
                    product_id: product?.id,
                    product_name: product?.name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    is_wholesale: item.is_wholesale,
                    tier_label: item.tier_label
                };
            });

            await getSupabase().from('order_items').insert(orderItems);

            // Update stock quantities
            for (const item of items || []) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const product = Array.isArray((item as any).product) ? (item as any).product[0] : (item as any).product;
                try {
                    await getSupabase().rpc('decrement_stock', {
                        product_id: product?.id,
                        qty: (item as { quantity: number }).quantity
                    });
                } catch {
                    // Fallback if RPC doesn't exist - just skip
                }
            }

            // Update transfer status
            await supabase
                .from('transfer_codes')
                .update({ status: 'confirmed', staff_id: staffId })
                .eq('id', transferId);

            // Clear cart
            await getSupabase().from('cart_items').delete().eq('cart_id', transfer.cart_id);

            return NextResponse.json({
                success: true,
                order_id: order.id,
                total,
                discount: totalDiscount
            });

        } else if (action === 'cancel') {
            await supabase
                .from('transfer_codes')
                .update({ status: 'cancelled', staff_id: staffId })
                .eq('id', transferId);

            return NextResponse.json({ success: true, cancelled: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Process error:', error);
        return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
    }
}

