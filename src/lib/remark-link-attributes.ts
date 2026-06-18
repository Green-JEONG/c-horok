type MdastRoot = {
  type: string;
  children?: MdastNode[];
};

type MdastNode = {
  type: string;
  value?: string;
  children?: MdastNode[];
  data?: {
    hProperties?: Record<string, string>;
  };
};

const LINK_ATTRIBUTE_PATTERN = /^\s*\{\s*:?([^}]+)\}\s*$/;

function decodeAttributeValue(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function parseMarkdownAttributeBlock(
  attrBlock: string,
): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern =
    /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s}]+))/g;
  let match = pattern.exec(attrBlock);

  while (match) {
    const rawValue = match[2] ?? match[3] ?? match[4] ?? "";
    attrs[match[1]] = decodeAttributeValue(rawValue);
    match = pattern.exec(attrBlock);
  }

  return attrs;
}

function applyLinkAttributes(link: MdastNode, attrBlock: string): boolean {
  const attrs = parseMarkdownAttributeBlock(attrBlock);
  if (Object.keys(attrs).length === 0) {
    return false;
  }

  link.data = link.data ?? {};
  link.data.hProperties = {
    ...(link.data.hProperties ?? {}),
    ...attrs,
  };

  if (attrs.target === "_blank" && !attrs.rel) {
    link.data.hProperties.rel = "noopener noreferrer";
  }

  return true;
}

function processLinkAttributeSiblings(children: MdastNode[]) {
  for (let index = 0; index < children.length - 1; index += 1) {
    const current = children[index];
    const next = children[index + 1];

    if (current.type !== "link" || next.type !== "text" || !next.value) {
      continue;
    }

    const match = next.value.match(LINK_ATTRIBUTE_PATTERN);
    if (!match || !applyLinkAttributes(current, match[1])) {
      continue;
    }

    children.splice(index + 1, 1);
    index -= 1;
  }
}

function visit(node: MdastNode) {
  if (node.children) {
    processLinkAttributeSiblings(node.children);
    for (const child of node.children) {
      visit(child);
    }
  }
}

export function remarkLinkAttributes() {
  return (tree: MdastRoot) => {
    visit(tree);
  };
}
