/** Builds an element tree from an HTML string. The string must have a single root. */
export function fromHtml<T extends HTMLElement = HTMLElement>(html: string): T {
  const template = document.createElement('template')
  template.innerHTML = html.trim()
  const root = template.content.firstElementChild
  if (!root) throw new Error('fromHtml: markup has no root element')
  return root as T
}

/** `querySelector` that fails loudly instead of returning null. */
export function query<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector)
  if (!found) throw new Error(`Expected element matching "${selector}"`)
  return found
}
