import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { createRoot } from "react-dom/client";
import PostDownloadPdfContent from "@/components/posts/PostDownloadPdfContent";
import { sanitizeDownloadFileName } from "@/lib/post-download";

type CapturePostPdfParams = {
  title: string;
  content: string;
  authorName: string;
  createdAtText: string;
  postUrl: string;
};

async function waitForImages(root: ParentNode) {
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

export async function downloadPostPdfFile(params: CapturePostPdfParams) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;

  if (!doc) {
    iframe.remove();
    throw new Error("PDF 문서를 생성할 수 없습니다.");
  }

  doc.open();
  doc.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>',
  );
  doc.close();

  const mountNode = doc.createElement("div");
  doc.body.appendChild(mountNode);

  const root = createRoot(mountNode);

  try {
    root.render(<PostDownloadPdfContent {...params} />);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    await waitForImages(doc.body);

    const canvas = await html2canvas(doc.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imageData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "p",
      unit: "pt",
      format: "a4",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;
    const imageHeight = (canvas.height * printableWidth) / canvas.width;
    let heightLeft = imageHeight;
    let offsetY = margin;

    pdf.addImage(
      imageData,
      "PNG",
      margin,
      offsetY,
      printableWidth,
      imageHeight,
      undefined,
      "FAST",
    );
    heightLeft -= printableHeight;

    while (heightLeft > 0) {
      offsetY -= printableHeight;
      pdf.addPage();
      pdf.addImage(
        imageData,
        "PNG",
        margin,
        offsetY,
        printableWidth,
        imageHeight,
        undefined,
        "FAST",
      );
      heightLeft -= printableHeight;
    }

    pdf.save(`${sanitizeDownloadFileName(params.title)}.pdf`);
  } finally {
    root.unmount();
    iframe.remove();
  }
}
