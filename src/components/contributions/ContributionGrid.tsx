"use client";

import { useEffect, useMemo, useState } from "react";

type Contribution = {
  date: string;
  count: number;
};

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getColor(count: number) {
  if (count === 0) return "bg-muted";
  if (count < 2) return "bg-emerald-200";
  if (count < 4) return "bg-emerald-400";
  return "bg-emerald-600";
}

function getTextColor(count: number) {
  if (count === 0) return "";
  if (count < 4) return "text-emerald-950";
  return "text-white";
}

const WEEKS = 48;
const DAYS = WEEKS * 7;

export default function ContributionGrid({ userId }: { userId?: number }) {
  const [data, setData] = useState<Contribution[]>([]);
  const [visibleWeeks, setVisibleWeeks] = useState(WEEKS);

  const map = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of data) {
      m.set(d.date, d.count);
    }
    return m;
  }, [data]);

  const days = useMemo(() => {
    const result: string[] = [];
    const today = new Date();

    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      result.push(formatLocalDate(d));
    }
    return result;
  }, []);

  const visibleDays = useMemo(() => {
    return days.slice(-visibleWeeks * 7);
  }, [days, visibleWeeks]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (userId) {
      params.set("userId", String(userId));
    }

    const query = params.toString();

    fetch(`/api/users/contributions${query ? `?${query}` : ""}`)
      .then(async (res) => {
        if (!res.ok) {
          console.error("API failed:", res.status);
          return [];
        }
        return res.json();
      })
      .then((d) => {
        console.log("CONTRIBUTIONS:", d);
        setData(Array.isArray(d) ? d : []);
      })
      .catch((err) => {
        console.error("fetch error:", err);
        setData([]);
      });
  }, [userId]);

  useEffect(() => {
    const updateVisibleWeeks = () => {
      const width = window.innerWidth;

      if (width < 420) {
        setVisibleWeeks(12);
        return;
      }

      if (width < 640) {
        setVisibleWeeks(24);
        return;
      }

      if (width < 840) {
        setVisibleWeeks(36);
        return;
      }

      setVisibleWeeks(WEEKS);
    };

    updateVisibleWeeks();
    window.addEventListener("resize", updateVisibleWeeks);

    return () => {
      window.removeEventListener("resize", updateVisibleWeeks);
    };
  }, []);

  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-sm font-semibold"></p>

      <div
        className="grid w-full gap-[3px]"
        style={{
          gridAutoFlow: "column",
          gridTemplateRows: "repeat(7, minmax(0, 1fr))",
          gridTemplateColumns: `repeat(${visibleWeeks}, minmax(0, 1fr))`,
        }}
      >
        {visibleDays.map((date) => {
          const count = map.get(date) ?? 0;
          return (
            <div
              key={date}
              title={`${date}: ${count}회`}
              className={`contribution-day flex aspect-square w-full items-center justify-center text-[8px] font-semibold leading-none tabular-nums ${getColor(count)} ${getTextColor(count)}`}
            >
              {count > 0 ? count : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
