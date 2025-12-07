import { NextRequest, NextResponse } from 'next/server';
import { searchWithDino } from '@/lib/nvidia-dino';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { image, prompt } = body;

        if (!image) {
            return NextResponse.json(
                { error: 'No image provided' },
                { status: 400 }
            );
        }

        // Convert base64 to buffer
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Run DINO detection
        const result = await searchWithDino(imageBuffer, prompt);

        return NextResponse.json({
            success: true,
            detections: result.detections,
            processingTime: result.processingTime,
            prompt: prompt || 'auto-generated from database',
        });
    } catch (error) {
        console.error('DINO search error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Detection failed' },
            { status: 500 }
        );
    }
}
