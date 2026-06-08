<div align="center">
  <a href="https://c-horok.com">
    <img width="205" height="215" alt="c.horok_logo" src="https://github.com/user-attachments/assets/bfb7ba2d-724d-4c15-bcae-1be0d81c6ff2" />
  </a>

  <br>c.horok은 호록 컴퍼니의 기술 콘텐츠를 중심으로 운영하는 커뮤니티형 블로그 프로젝트입니다.
  
</div>

# 🧩 Version

<details>
<summary><s>🥚 v0.1.0</s></summary>

  > 기술 블로그
  
  ![이미지](https://github.com/user-attachments/assets/8f302e44-9123-452c-8d03-2d1dec0ad9bd)
    
  ### 🍽️ 기능
  1. 로그인
  - 아이디 및 비밀번호
  - 깃허브 OAuth 간편계정
  - 구글 OAuth 간편계정
    
  2. 탭
  - 홈
  - 피드
  - 좋아요
    
  3. 바로가기
  - 인기글
  - 카테고리
    
  4. 기능
  - 검색 (키워드 기반)
  - 라이트/다크 모드
  - 마이페이지 구경 (작성한 댓글, 글, 친구)
  - 회원탈퇴
  - 로그아웃
  - 잔디 (게시글 작성 기반)
  - 게시글 정렬 (최신, 조회, 좋아요, 댓글순 中 선택)
  - 게시글·댓글 작성, 수정, 삭제
    
  5. 관리자 페이지
    
  ![이미지](https://github.com/user-attachments/assets/b29f710d-e8b8-4667-a775-9fde63ce77a2)
    
  - 관리자 전용 접근 제어
  - 회원 목록 조회
  - 게시글 목록 조회 및 관리
  - 댓글 목록 조회 및 관리
  - 사용자 권한 변경
  - 사용자 삭제
  - 관리자 화면에서 게시글 생성/수정/삭제

  6. 게시글
  - 카테고리 자동 관리
  - 게시글 상세 페이지
  - 댓글 작성, 수정, 삭제
  - 대댓글 구조 지원
  - 좋아요한 글 목록 조회

</details>

<details open>
<summary>🐣 v1.0.0</summary>

  > 기존 블로그 구조 위에 인증, 게시글/댓글/좋아요, 마이페이지, 관리자 기능, AI 챗봇, 이메일 로그인까지 통합한 상태로 확장을 마친 상태입니다.

  ### 🍽️ 기능
  1. 로그인
  - 이메일 매직 링크 로그인

  ![Mar-29-2026 15-10-05](https://github.com/user-attachments/assets/8c8cd01a-960f-4b4e-96ef-2b8618694d95)
  
  - 회원가입 시 이메일/닉네임 중복 확인

  ![Mar-29-2026 15-12-42](https://github.com/user-attachments/assets/efd38b28-d20f-4d78-b9c6-0edaf14dc0e7)

  - 비밀번호 재설정 및 계정 정보 수정

  ![Mar-29-2026 15-15-05](https://github.com/user-attachments/assets/1bf1aee7-6f73-4eae-9aae-975e9c66c9d3)

  2. 게시글

  ![Mar-29-2026 15-44-19](https://github.com/user-attachments/assets/c7f363f6-2bb7-4771-a2a0-cfd5f02377ab)

  - 게시글 작성, 수정, 삭제(소프트 삭제)

  ![Mar-29-2026 15-45-20](https://github.com/user-attachments/assets/16e92c60-9a2d-4db0-a9bc-e3f786fc47bb)

  - Markdown 기반 게시글 작성 및 렌더링
  - 썸네일 이미지 업로드
  - 조회수 집계
  - 알림 데이터 모델 구성

  ![Mar-29-2026 15-46-43](https://github.com/user-attachments/assets/1862b8ed-e845-4200-8ccc-a08cb91ed583)

  3. 마이페이지

  ![Mar-29-2026 15-47-28](https://github.com/user-attachments/assets/579ac8b7-6494-4f1d-82dc-aa32908e76bb)

  - 내가 작성한 글 목록
  - 내가 작성한 댓글 목록
  - 친구 목록

  4. AI

  ![Mar-29-2026 15-48-06](https://github.com/user-attachments/assets/53986a23-f4f5-4ad4-bfc3-454a1485a15e)

  - Google Generative AI 기반 Horok 챗봇
  - 우하단 플로팅 챗봇 UI
  - 스트리밍 응답 처리

</details>

<details>
<summary>🐤 v2.0.0 <i>(In progress..)</i></summary>

  > Horok 통합 페이지 만들기
  
  1️⃣ 소개
    
  2️⃣ 기술 블로그
  - 영상(애니메이션)
  - 네컷만화
  - 추천 카테고리 노출
    
  3️⃣ Shop (*Coming Soon..*)

</details>

## 1. 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| Web App | Next.js App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4, Radix UI, `class-variance-authority`, `tailwind-merge` |
| Auth | NextAuth v5 beta, Credentials, GitHub, Google, Nodemailer provider |
| DB | PostgreSQL, Prisma |
| Storage | Supabase Storage |
| Markdown | `react-markdown`, `remark-gfm`, `rehype-highlight`, `rehype-sanitize` |
| AI | `ai`, `@ai-sdk/react`, `@ai-sdk/google` |
| Tooling | Biome, Storybook, Vitest, Playwright |

## 🚀 Run Server
```bash
pnpm install
pnpm dev
```
