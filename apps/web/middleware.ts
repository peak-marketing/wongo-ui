import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
  
  // 로그인/회원가입 페이지는 토큰 검사 제외
  if (request.nextUrl.pathname.startsWith('/auth/')) {
    return NextResponse.next();
  }

  // 클라이언트 사이드에서 토큰 확인 (서버에서는 쿠키나 헤더만 확인 가능)
  // 여기서는 기본 경로만 체크하고, 상세한 검증은 클라이언트에서 처리
  if (request.nextUrl.pathname.startsWith('/agency') || request.nextUrl.pathname.startsWith('/admin')) {
    // 클라이언트 사이드 가드로 처리
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/agency/:path*', '/admin/:path*', '/auth/:path*'],
};









