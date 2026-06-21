type MdastRoot = {
  type: string;
  children?: MdastNode[];
};

type MdastNode = {
  type: string;
  url?: string;
  value?: string;
  children?: MdastNode[];
};

function getLinkText(node: MdastNode): string {
  return (node.children ?? [])
    .map((child) => (child.type === "text" ? (child.value ?? "") : ""))
    .join("");
}

function isAutolinkLiteral(node: MdastNode): boolean {
  if (node.type !== "link" || !node.url || !node.children?.length) {
    return false;
  }

  const text = getLinkText(node);

  if (text === node.url) {
    return true;
  }

  if (node.url.startsWith("mailto:") && text === node.url.slice("mailto:".length)) {
    return true;
  }

  return false;
}

function visit(node: MdastNode) {
  if (!node.children) {
    return;
  }

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];

    if (isAutolinkLiteral(child)) {
      node.children[index] = {
        type: "text",
        value: getLinkText(child),
      };
      continue;
    }

    visit(child);
  }
}

/** GFM autolink literal(생 URL)을 일반 텍스트로 렌더링합니다. */
export function remarkDisableAutolinkLiterals() {
  return (tree: MdastRoot) => {
    visit(tree);
  };
}
