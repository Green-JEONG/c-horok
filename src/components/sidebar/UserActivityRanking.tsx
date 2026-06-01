"use client";

import { Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type RankingUser = {
  rank: number;
  userId: number;
  name: string | null;
  image: string | null;
};

export default function UserActivityRanking() {
  const [ranking, setRanking] = useState<RankingUser[]>([]);

  useEffect(() => {
    fetch("/api/users/activity-ranking")
      .then((res) => res.json())
      .then((data) => {
        setRanking(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setRanking([]);
      });
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-[18px] w-[18px]" />
        <h3 className="text-lg font-bold tracking-tight">활동 랭킹</h3>
      </div>

      {ranking.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          아직 활동 랭킹이 없습니다.
        </p>
      ) : (
        <ol className="space-y-2 text-sm">
          {ranking.map((user) => (
            <li key={user.userId}>
              <Link
                href={`/users/${user.userId}`}
                className="flex items-center gap-2 rounded-lg border border-transparent bg-background px-1 py-1 text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
              >
                <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-foreground/80">
                  {user.rank}
                </span>
                <Image
                  src={user.image ?? "/logo.png"}
                  alt={`${user.name ?? "유저"} 프로필`}
                  width={28}
                  height={28}
                  className={`h-7 w-7 shrink-0 rounded-full border object-cover ${!user.image ? "grayscale" : ""}`}
                />
                <span className="min-w-0 flex-1 truncate">
                  {user.name ?? "이름 없는 사용자"}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
