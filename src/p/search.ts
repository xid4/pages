export interface SearchElements {
  bar: HTMLElement;
  input: HTMLInputElement;
  count: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  close: HTMLButtonElement;
}

/**
 * Busca no texto baseada na camada de texto renderizada.
 * Limitação: destaca ocorrências contidas em um único "span"; termos quebrados
 * entre spans podem não ser encontrados.
 */
export class SearchController {
  private query = "";
  private marks: HTMLElement[] = [];
  private index = -1;

  constructor(private readonly el: SearchElements) {}

  attach(): void {
    this.el.input.addEventListener("input", () => this.performSearch(this.el.input.value.trim()));
    this.el.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (this.marks.length) this.setActiveMatch(this.index + (event.shiftKey ? -1 : 1));
      } else if (event.key === "Escape") {
        this.close();
      }
    });
    this.el.next.addEventListener("click", () => this.setActiveMatch(this.index + 1));
    this.el.prev.addEventListener("click", () => this.setActiveMatch(this.index - 1));
    this.el.close.addEventListener("click", () => this.close());
  }

  get isOpen(): boolean {
    return this.el.bar.classList.contains("open");
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.el.bar.classList.add("open");
    this.el.input.focus();
    this.el.input.select();
  }

  close(): void {
    this.el.bar.classList.remove("open");
    this.el.input.value = "";
    this.performSearch("");
  }

  // Reaplica o destaque após uma nova renderização (ex.: zoom).
  refresh(): void {
    if (this.query) this.performSearch(this.query, false);
  }

  // Remove apenas os <mark> da busca, preservando eventuais <a> (links inline).
  private clearHighlights(): void {
    document.querySelectorAll<HTMLElement>("#pages .textLayer mark").forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
      parent.normalize();
    });
    this.marks = [];
    this.index = -1;
  }

  // Destaca ocorrências percorrendo os NÓS DE TEXTO do span (inclusive os que
  // ficam dentro de um <a>), sem reconstruir o span — assim os links inline
  // continuam intactos durante a busca.
  private highlightTextNodes(root: Node, query: string, marks: HTMLElement[]): void {
    const target = query.toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      textNodes.push(node as Text);
    }

    for (const node of textNodes) {
      const text = node.nodeValue ?? "";
      const lower = text.toLowerCase();
      let position = lower.indexOf(target);
      if (position === -1) continue;

      const fragment = document.createDocumentFragment();
      let from = 0;
      while (position !== -1) {
        if (position > from) fragment.appendChild(document.createTextNode(text.slice(from, position)));
        const mark = document.createElement("mark");
        mark.textContent = text.slice(position, position + query.length);
        fragment.appendChild(mark);
        marks.push(mark);
        from = position + query.length;
        position = lower.indexOf(target, from);
      }
      if (from < text.length) fragment.appendChild(document.createTextNode(text.slice(from)));
      node.parentNode?.replaceChild(fragment, node);
    }
  }

  performSearch(query: string, resetIndex = true): void {
    this.clearHighlights();
    this.query = query;
    if (!query) {
      this.updateCount();
      return;
    }

    const marks: HTMLElement[] = [];
    document.querySelectorAll<HTMLElement>("#pages .textLayer span").forEach((span) => {
      this.highlightTextNodes(span, query, marks);
    });
    this.marks = marks;

    if (marks.length) {
      this.index = resetIndex ? 0 : Math.min(Math.max(this.index, 0), marks.length - 1);
      this.setActiveMatch(this.index, resetIndex);
    } else {
      this.index = -1;
    }
    this.updateCount();
  }

  private setActiveMatch(index: number, scrollTo = true): void {
    if (!this.marks.length) return;
    this.marks.forEach((mark) => mark.classList.remove("active"));
    const normalized = (index + this.marks.length) % this.marks.length;
    this.index = normalized;
    const mark = this.marks[normalized];
    mark.classList.add("active");
    if (scrollTo) mark.scrollIntoView({ behavior: "smooth", block: "center" });
    this.updateCount();
  }

  private updateCount(): void {
    const total = this.marks.length;
    const current = total ? this.index + 1 : 0;
    this.el.count.textContent = `${current}/${total}`;
  }
}
