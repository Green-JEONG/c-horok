"use client";

import { useState } from "react";
import type { PostThumbnailCrop } from "@/lib/post-thumbnail-crop";
import SectionPagination from "@/components/mypage/sections/SectionPagination";
import PostCard from "./PostCard";

const PAGE_SIZE = 12;

type PostItem = {
  id: number;
  title: string;
  content: string;
  thumbnail: string | null;
  thumbnail_crop?: PostThumbnailCrop | null;
  created_at: Date | string;
  author_name: string;
  author_image?: string | null;
  category_name: string;
  view_count?: number;
  likes_count: number;
  reactions_count?: number;
  comments_count: number;
  is_hidden?: boolean;
  is_secret?: boolean;
  can_view_secret?: boolean;
};

export default function PostGridPagination({ posts }: { posts: PostItem[] }) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const pagedPosts = posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pagedPosts.map((post, index) => (
          <PostCard
            key={post.id}
            id={post.id}
            title={post.title}
            description={post.content}
            thumbnail={post.thumbnail}
            thumbnailCrop={post.thumbnail_crop ?? null}
            category={post.category_name}
            author={post.author_name}
            authorImage={post.author_image}
            likes={post.likes_count}
            reactions={post.reactions_count ?? 0}
            comments={post.comments_count}
            views={post.view_count}
            createdAt={new Date(post.created_at)}
            isHidden={post.is_hidden}
            isSecret={post.is_secret}
            canViewSecret={post.can_view_secret}
            thumbnailLoading={index < 10 ? "eager" : "lazy"}
            thumbnailPriority={index === 0}
          />
        ))}
      </div>

      <SectionPagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
