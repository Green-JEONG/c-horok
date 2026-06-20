"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { CSSProperties, TouchEvent } from "react";
import { useEffect, useRef, useState } from "react";

const services = [
  {
    href: "/horok-log",
    folderColor: "bg-[#ffca72]",
    tabColor: "bg-[#f89b0f]",
    titleAccent: "log",
    titleAccentColor: "#c96f00",
    label: "호록 ",
    accent: "블로그",
    accentClassName: "text-[#ff9800]",
  },
  {
    href: "/horok-coding",
    folderColor: "bg-[#70d195]",
    tabColor: "bg-[#52bc75]",
    titleAccent: "coding",
    titleAccentColor: "#19884a",
    label: "호록 ",
    accent: "코딩",
    accentClassName: "text-[#44bb68]",
  },
  {
    href: "/horok-academy",
    folderColor: "bg-[#ff7b7b]",
    tabColor: "bg-[#eb5551]",
    titleAccent: "academy",
    titleAccentColor: "#bd2424",
    label: "호록 ",
    accent: "교육",
    accentClassName: "text-[#eb5551]",
  },
  {
    href: "/horok-item",
    folderColor: "bg-[#6b94eb]",
    tabColor: "bg-[#5383e9]",
    titleAccent: "item",
    titleAccentColor: "#205fc9",
    label: "호록 ",
    accent: "굿즈",
    accentClassName: "text-[#5c8fff]",
  },
] as const;

const carouselSlotStyles = [
  {
    transform:
      "translate(-50%, -50%) translate3d(0, 0, 180px) rotateY(0deg) rotateZ(0deg) scale(1)",
    opacity: 1,
    filter: "brightness(1) saturate(1)",
    zIndex: 40,
  },
  {
    transform:
      "translate(-50%, -50%) translate3d(min(14rem, 30vw), -1.25rem, -170px) rotateY(-40deg) rotateZ(8deg) scale(0.64)",
    opacity: 0.56,
    filter: "brightness(0.44) saturate(0.7) blur(0.45px)",
    zIndex: 24,
  },
  {
    transform:
      "translate(-50%, -50%) translate3d(0, -6.75rem, -330px) rotateY(0deg) rotateZ(2deg) scale(0.48)",
    opacity: 0.34,
    filter: "brightness(0.34) saturate(0.58) blur(0.75px)",
    zIndex: 12,
  },
  {
    transform:
      "translate(-50%, -50%) translate3d(calc(-1 * min(14rem, 30vw)), -1.25rem, -170px) rotateY(40deg) rotateZ(-8deg) scale(0.64)",
    opacity: 0.56,
    filter: "brightness(0.44) saturate(0.7) blur(0.45px)",
    zIndex: 24,
  },
] satisfies CSSProperties[];

const swipeThreshold = 44;

export default function RootPortal() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    for (const service of services) {
      router.prefetch(service.href);
    }
  }, [router]);

  function showPreviousService() {
    setActiveIndex((current) =>
      current === 0 ? services.length - 1 : current - 1,
    );
  }

  function showNextService() {
    setActiveIndex((current) =>
      current === services.length - 1 ? 0 : current + 1,
    );
  }

  function showService(index: number) {
    setActiveIndex(index);
  }

  function getCarouselSlot(index: number) {
    return (index - activeIndex + services.length) % services.length;
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];

    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;

    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (
      Math.abs(deltaX) < swipeThreshold ||
      Math.abs(deltaY) > Math.abs(deltaX)
    ) {
      return;
    }

    if (deltaX < 0) {
      showNextService();
      return;
    }

    showPreviousService();
  }

  return (
    <main className="relative flex min-h-dvh overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.09)_0%,rgba(0,0,0,0)_42%),linear-gradient(90deg,rgba(0,0,0,0.96)_0%,rgba(0,0,0,0.72)_28%,rgba(0,0,0,0.36)_50%,rgba(0,0,0,0.72)_72%,rgba(0,0,0,0.96)_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[78dvh] w-[46rem] max-w-[92vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.38)_22%,rgba(255,255,255,0.13)_48%,rgba(255,255,255,0)_72%)] blur-2xl" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[72dvh] w-[28rem] max-w-[70vw] -translate-x-1/2 bg-[linear-gradient(180deg,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.2)_48%,rgba(255,255,255,0)_100%)] opacity-80 blur-xl [clip-path:polygon(32%_0,68%_0,100%_100%,0_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42dvh] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.05)_34%,rgba(0,0,0,0)_68%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.28)_56%,rgba(0,0,0,0.86)_100%)]" />

      <section className="relative z-10 mx-auto flex min-h-dvh w-full max-w-5xl flex-col items-center justify-center px-6 py-16">
        <div
          className="relative flex min-h-[26rem] w-full translate-y-24 touch-pan-y select-none items-center justify-center sm:translate-y-28 lg:translate-y-32"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={showPreviousService}
            className="absolute left-0 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/18 bg-white/8 text-white/80 shadow-[0_0_24px_rgba(255,255,255,0.12)] backdrop-blur transition hover:border-white/35 hover:bg-white/14 hover:text-white focus-visible:ring-2 focus-visible:ring-white/80 sm:left-8"
            aria-label="이전 폴더 보기"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="pointer-events-none absolute bottom-16 h-20 w-72 rounded-full bg-white/16 blur-2xl" />

          <div
            className="absolute inset-0 flex items-center justify-center overflow-visible"
            style={{
              perspective: "900px",
              transformStyle: "preserve-3d",
            }}
          >
            {services.map((service, index) => {
              const slot = getCarouselSlot(index);
              const isActive = slot === 0;
              const slotStyle = carouselSlotStyles[slot];
              const colorLayerTone = isActive
                ? "brightness-100 saturate-100"
                : "brightness-[0.32] saturate-[0.62] group-hover:brightness-100 group-hover:saturate-100 group-focus-visible:brightness-100 group-focus-visible:saturate-100";
              const folderLayer = (
                <>
                  <div className="absolute left-0 top-0 h-[92%] w-[56%] origin-top-left rounded-[28px] border border-r-0 border-white/42 shadow-[-10px_0_22px_rgba(255,255,255,0.3)] transition duration-300 group-hover:-translate-x-2 group-hover:-translate-y-1 group-hover:-rotate-3 group-hover:border-white/62 group-hover:shadow-[-12px_0_28px_rgba(255,255,255,0.42)] group-focus-visible:-translate-x-2 group-focus-visible:-translate-y-1 group-focus-visible:-rotate-3" />
                  <div className="absolute right-0 top-1 h-[88%] w-[56%] origin-top-right rounded-[28px] border border-l-0 border-white/42 shadow-[10px_0_22px_rgba(255,255,255,0.3)] transition duration-300 group-hover:translate-x-2 group-hover:-translate-y-1 group-hover:rotate-3 group-hover:border-white/62 group-hover:shadow-[12px_0_28px_rgba(255,255,255,0.42)] group-focus-visible:translate-x-2 group-focus-visible:-translate-y-1 group-focus-visible:rotate-3" />
                  <div className="absolute inset-x-0 top-8 bottom-0 rounded-[34px] border border-white/56 shadow-[0_0_26px_rgba(255,255,255,0.46),inset_0_0_14px_rgba(255,255,255,0.12)] transition duration-300 group-hover:-translate-y-2 group-hover:rotate-[-1.5deg] group-hover:border-white/72 group-hover:shadow-[0_0_34px_rgba(255,255,255,0.62),inset_0_0_16px_rgba(255,255,255,0.18)] group-focus-visible:-translate-y-2 group-focus-visible:rotate-[-1.5deg]" />
                  <div
                    className={`absolute left-0 top-0 h-[92%] w-[56%] origin-top-left rounded-[28px] ${service.tabColor} ${colorLayerTone} shadow-[-10px_0_28px_rgba(255,255,255,0.18)] transition duration-300 group-hover:-translate-x-2 group-hover:-translate-y-1 group-hover:-rotate-3 group-focus-visible:-translate-x-2 group-focus-visible:-translate-y-1 group-focus-visible:-rotate-3`}
                  />
                  <div
                    className={`absolute right-0 top-1 h-[88%] w-[56%] origin-top-right rounded-[28px] ${service.tabColor} ${colorLayerTone} shadow-[10px_0_28px_rgba(255,255,255,0.18)] transition duration-300 group-hover:translate-x-2 group-hover:-translate-y-1 group-hover:rotate-3 group-focus-visible:translate-x-2 group-focus-visible:-translate-y-1 group-focus-visible:rotate-3`}
                  />
                  <div
                    className={`relative rounded-[24px] ${service.folderColor} ${colorLayerTone} px-3.5 py-7 shadow-[0_36px_76px_rgba(0,0,0,0.7),0_0_44px_rgba(255,255,255,0.2)] transition duration-300 group-hover:-translate-y-2 group-hover:rotate-[-1.5deg] group-hover:shadow-[0_42px_88px_rgba(0,0,0,0.8),0_0_56px_rgba(255,255,255,0.26)] group-focus-visible:-translate-y-2 group-focus-visible:rotate-[-1.5deg] group-focus-visible:ring-2 group-focus-visible:ring-white/80 sm:rounded-[28px] sm:px-5 sm:py-10 md:rounded-[30px] md:px-6 md:py-12`}
                  >
                    <p className="relative isolate translate-y-4 whitespace-pre-line text-[1.2rem] font-black leading-[0.92] text-black sm:translate-y-5 sm:text-[1.65rem] md:translate-y-6 md:text-[1.95rem] xl:translate-y-8 xl:text-[2.5rem]">
                      <span className="relative inline-block">
                        <Image
                          src="/logo.png"
                          alt=""
                          width={96}
                          height={96}
                          aria-hidden="true"
                          className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[2.2em] max-w-none -translate-x-1/2 -translate-y-[108%] opacity-55"
                        />
                        <span className="relative z-10">horok</span>
                      </span>
                      <br />
                      <span
                        className="relative z-10"
                        style={{
                          color: service.titleAccentColor,
                        }}
                      >
                        {service.titleAccent}
                      </span>
                    </p>
                  </div>
                </>
              );

              const itemClassName = `group absolute left-1/2 top-1/2 flex min-w-0 flex-col items-center text-center outline-none transition-[transform,opacity,filter] duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
                isActive ? "" : "cursor-pointer"
              }`;
              const itemStyle = {
                ...slotStyle,
                transformStyle: "preserve-3d" as const,
              };
              const itemLabel = isActive
                ? `${service.label}${service.accent}로 이동`
                : `${service.label}${service.accent} 폴더 앞으로 가져오기`;
              const itemContent = (
                <>
                  <div className="relative w-[min(9.75rem,44vw)] pt-8 transition duration-300 group-hover:-translate-y-2 group-focus-visible:-translate-y-2 sm:w-[min(12rem,52vw)] md:w-[min(15rem,64vw)]">
                    {folderLayer}
                  </div>
                  <p
                    className={`mt-4 text-[1.15rem] font-medium tracking-tight drop-shadow-[0_0_18px_rgba(255,255,255,0.22)] transition duration-300 group-focus-visible:translate-y-1 group-focus-visible:scale-[1.02] sm:mt-5 sm:text-[1.35rem] md:mt-6 md:text-[1.55rem] lg:text-[1.7rem] ${
                      isActive
                        ? "text-white group-hover:translate-y-1 group-hover:scale-[1.02] group-hover:drop-shadow-[0_0_18px_rgba(255,255,255,0.38)]"
                        : "text-white/36"
                    }`}
                  >
                    {service.label}
                    <span className={service.accentClassName}>
                      {service.accent}
                    </span>
                  </p>
                </>
              );

              if (isActive) {
                return (
                  <a
                    key={service.href}
                    href={service.href}
                    className={itemClassName}
                    style={itemStyle}
                    aria-label={itemLabel}
                  >
                    {itemContent}
                  </a>
                );
              }

              return (
                <button
                  key={service.href}
                  type="button"
                  onClick={() => showService(index)}
                  className={itemClassName}
                  style={itemStyle}
                  aria-label={itemLabel}
                >
                  {itemContent}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={showNextService}
            className="absolute right-0 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/18 bg-white/8 text-white/80 shadow-[0_0_24px_rgba(255,255,255,0.12)] backdrop-blur transition hover:border-white/35 hover:bg-white/14 hover:text-white focus-visible:ring-2 focus-visible:ring-white/80 sm:right-8"
            aria-label="다음 폴더 보기"
          >
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <div className="absolute bottom-12 left-1/2 flex -translate-x-1/2 items-center justify-center gap-2">
          {services.map((service, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={service.href}
                type="button"
                onClick={() => showService(index)}
                className={`h-2.5 rounded-full transition ${
                  isActive
                    ? "w-9 bg-white shadow-[0_0_16px_rgba(255,255,255,0.6)]"
                    : "w-2.5 bg-white/32 hover:bg-white/55"
                }`}
                aria-label={`${service.label}${service.accent} 폴더 보기`}
                aria-current={isActive ? "true" : undefined}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}
