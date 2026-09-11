import {
  SYMBOL_CATALOG,
  CATALOG_CATEGORY_ORDER,
  type SymbolCatalogItem,
  type SymbolCategory,
} from './symbolPalette';
import type { SelectionInfo } from '../common/types';

declare function acquireVsCodeApi(): { postMessage: (m: unknown) => void };
const vscode = acquireVsCodeApi();

type PanelInbound =
  | { type: 'state'; active: boolean }
  | { type: 'selection'; selection: SelectionInfo | null };

const view = document.body.dataset.view;
const root = document.getElementById('root');

if (root) {
  if (view === 'symbols') initSymbols(root);
  else if (view === 'properties') initProperties(root);
}

// ── Symbols view ───────────────────────────────────────────────────────
function initSymbols(container: HTMLElement): void {
  let query = '';
  let active = false;

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Filter symbols…';
  search.className = 'panel-search';
  search.addEventListener('input', () => {
    query = search.value.trim().toLowerCase();
    renderList();
  });

  const empty = document.createElement('div');
  empty.className = 'panel-empty';
  empty.textContent = 'Open a P&ID diagram to place symbols.';

  const list = document.createElement('div');
  list.className = 'symbol-list';

  container.append(search, empty, list);

  const byCategory = new Map<SymbolCategory, SymbolCatalogItem[]>();
  for (const item of SYMBOL_CATALOG) {
    const arr = byCategory.get(item.category) ?? [];
    arr.push(item);
    byCategory.set(item.category, arr);
  }

  function renderList(): void {
    list.innerHTML = '';
    for (const category of CATALOG_CATEGORY_ORDER) {
      const items = (byCategory.get(category) ?? []).filter(
        (it) => !query || it.label.toLowerCase().includes(query) || it.componentClass.toLowerCase().includes(query)
      );
      if (items.length === 0) continue;

      const section = document.createElement('details');
      section.open = true;
      const summary = document.createElement('summary');
      summary.textContent = `${category} (${items.length})`;
      section.appendChild(summary);

      const grid = document.createElement('div');
      grid.className = 'symbol-grid';
      for (const item of items) {
        grid.appendChild(renderTile(item));
      }
      section.appendChild(grid);
      list.appendChild(section);
    }
  }

  /** A generic category glyph — not a pre-baked DEXPI symbol. Real geometry is
   *  only known once the document itself defines it (see `renderNodeBody` in
   *  `webview/exportSvg.ts`), which a freshly-inserted element doesn't have yet. */
  function genericGlyph(elementType: SymbolCatalogItem['elementType']): string {
    if (elementType === 'ProcessInstrument') {
      return '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2" /></svg>';
    }
    if (elementType === 'PipingComponent') {
      return '<svg viewBox="0 0 40 40" width="40" height="40"><polygon points="4,10 20,20 4,30 36,30 20,20 36,10" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /></svg>';
    }
    return '<svg viewBox="0 0 40 40" width="40" height="40"><rect x="6" y="4" width="28" height="32" rx="3" fill="none" stroke="currentColor" stroke-width="2" /></svg>';
  }

  function renderTile(item: SymbolCatalogItem): HTMLElement {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'symbol-tile';
    tile.title = `${item.label} — ${item.componentClass}`;
    tile.disabled = !active;

    const thumb = document.createElement('span');
    thumb.className = 'symbol-thumb';
    thumb.innerHTML = genericGlyph(item.elementType);

    const label = document.createElement('span');
    label.className = 'symbol-label';
    label.textContent = item.label;

    tile.append(thumb, label);
    tile.addEventListener('click', () => {
      if (active) vscode.postMessage({ type: 'insert', itemId: item.id });
    });
    return tile;
  }

  function applyActive(next: boolean): void {
    active = next;
    empty.hidden = active;
    list.hidden = !active;
    search.hidden = !active;
    list.querySelectorAll<HTMLButtonElement>('.symbol-tile').forEach((b) => (b.disabled = !active));
  }

  window.addEventListener('message', (event) => {
    const msg = event.data as PanelInbound;
    if (msg.type === 'state') applyActive(msg.active);
  });

  renderList();
  applyActive(false);
  vscode.postMessage({ type: 'ready' });
}

// ── Properties view ────────────────────────────────────────────────────
function initProperties(container: HTMLElement): void {
  const empty = document.createElement('div');
  empty.className = 'panel-empty';
  empty.textContent = 'Select an element on the canvas to edit its DEXPI attributes.';

  const form = document.createElement('div');
  form.className = 'prop-form';
  form.hidden = true;

  container.append(empty, form);

  function render(selection: SelectionInfo | null): void {
    if (!selection) {
      empty.hidden = false;
      form.hidden = true;
      form.innerHTML = '';
      return;
    }
    empty.hidden = true;
    form.hidden = false;
    form.innerHTML = '';

    form.appendChild(readonlyField('Element type', selection.elementType));
    form.appendChild(readonlyField('Component class', selection.componentClass));
    form.appendChild(
      editableField('Tag name', selection.tagName, (value) =>
        vscode.postMessage({ type: 'patch', elementId: selection.id, property: 'tagName', value })
      )
    );

    const entries = Object.entries(selection.attributes);
    if (entries.length > 0) {
      const heading = document.createElement('div');
      heading.className = 'prop-heading';
      heading.textContent = 'Process parameters';
      form.appendChild(heading);
      for (const [name, attr] of entries) {
        const labelText = attr.units ? `${name} (${attr.units})` : name;
        form.appendChild(
          editableField(labelText, attr.value, (value) =>
            vscode.postMessage({ type: 'patch', elementId: selection.id, property: `attr:${name}`, value })
          )
        );
      }
    }
  }

  window.addEventListener('message', (event) => {
    const msg = event.data as PanelInbound;
    if (msg.type === 'selection') render(msg.selection);
    else if (msg.type === 'state' && !msg.active) render(null);
  });

  render(null);
  vscode.postMessage({ type: 'ready' });
}

function readonlyField(label: string, value: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'prop-field';
  wrap.innerHTML = `<label>${escapeHtml(label)}</label><div class="prop-value">${escapeHtml(value)}</div>`;
  return wrap;
}

function editableField(label: string, value: string, onCommit: (value: string) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'prop-field';
  const id = `f${Math.random().toString(36).slice(2)}`;
  wrap.innerHTML = `<label for="${id}">${escapeHtml(label)}</label>`;
  const input = document.createElement('input');
  input.id = id;
  input.type = 'text';
  input.value = value;
  input.addEventListener('change', () => onCommit(input.value));
  wrap.appendChild(input);
  return wrap;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
