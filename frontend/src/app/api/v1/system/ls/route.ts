import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    const path = request.nextUrl.searchParams.get('path');
    const url = `${backendUrl}/api/v1/system/ls${path ? `?path=${encodeURIComponent(path)}` : ''}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json({ error: errorData }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json({ error: 'Backend connection failed' }, { status: 503 });
  }
}
