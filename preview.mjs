let ui;
let active;

export function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(2)} MB`;
}

export function previewType(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (file.type === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (/^image\//.test(file.type) || /^(png|jpe?g|gif|webp|bmp|avif|svg|ico)$/.test(extension)) return 'image';
  if (/^text\//.test(file.type) || /^(txt|csv|tsv|md|json|log|xml|html?|css|js)$/.test(extension)) return 'text';
  return 'unsupported';
}

function setup() {
  if (ui) return;
  const get = id => document.querySelector(`#${id}`);
  ui = { dialog: get('preview-dialog'), title: get('preview-title'), details: get('preview-details'), content: get('preview-content'), controls: get('pdf-controls'), previous: get('previous-page'), next: get('next-page'), page: get('page-number') };
  get('close-preview').addEventListener('click', closePreview);
  ui.dialog.addEventListener('close', () => { if (!ui.dialog.open) release(); });
  ui.previous.addEventListener('click', () => renderPage(active, -1));
  ui.next.addEventListener('click', () => renderPage(active, 1));
}

function release() {
  const previous = active;
  active = null;
  if (previous?.render) previous.render.cancel();
  if (previous?.loading) void previous.loading.destroy().catch(() => {});
  ui?.content.replaceChildren();
  if (previous?.url) URL.revokeObjectURL(previous.url);
}

export function closePreview() {
  release();
  if (ui?.dialog.open) ui.dialog.close();
}

function message(text) {
  const paragraph = document.createElement('p');
  paragraph.className = 'preview-message';
  paragraph.setAttribute('role', 'status');
  paragraph.textContent = text;
  ui.content.replaceChildren(paragraph);
}

export async function openPreview(file) {
  setup();
  release();
  const session = { file, page: 1, rendering: false };
  active = session;
  ui.title.textContent = file.name;
  ui.details.textContent = `${formatSize(file.size)} · Preview stays on your device`;
  ui.controls.hidden = true;
  ui.content.setAttribute('aria-busy', 'true');
  message('Loading preview…');
  if (!ui.dialog.open) ui.dialog.showModal();
  try {
    const kind = previewType(file);
    if (kind === 'image') {
      const image = document.createElement('img');
      image.className = 'preview-image';
      image.alt = file.name;
      session.url = URL.createObjectURL(file);
      image.onload = () => { if (active === session) ui.content.setAttribute('aria-busy', 'false'); };
      image.onerror = () => {
        if (active !== session) return;
        ui.content.setAttribute('aria-busy', 'false');
        message('This image format could not be displayed. It can still be attached to your email. Try a JPG or PNG for preview.');
      };
      image.src = session.url;
      ui.content.replaceChildren(image);
    } else if (kind === 'text') {
      const limit = 1024 * 1024;
      const text = await file.slice(0, limit).text();
      if (active !== session) return;
      const pre = document.createElement('pre');
      pre.className = 'preview-text';
      // Render as literal text, including HTML/XML, never executable markup.
      pre.textContent = text;
      ui.content.replaceChildren(pre);
      if (file.size > limit) ui.details.textContent += ' · Showing the first 1 MB';
    } else if (kind === 'pdf') {
      const pdfjs = await import('./vendor/pdfjs/pdf.mjs');
      if (active !== session) return;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;
      const data = new Uint8Array(await file.arrayBuffer());
      if (active !== session) return;
      session.loading = pdfjs.getDocument({
        data,
        cMapUrl: new URL('./vendor/pdfjs/cmaps/', import.meta.url).href,
        cMapPacked: true,
        standardFontDataUrl: new URL('./vendor/pdfjs/standard_fonts/', import.meta.url).href,
        wasmUrl: new URL('./vendor/pdfjs/wasm/', import.meta.url).href,
        iccUrl: new URL('./vendor/pdfjs/iccs/', import.meta.url).href,
        isEvalSupported: false,
        enableXfa: false,
      });
      session.pdf = await session.loading.promise;
      if (active !== session) return;
      ui.controls.hidden = false;
      await renderPage(session, 0);
    } else {
      message('In-page preview is not available for this file type. The file can still be attached to your email. Choose PDF, an image or a text file for preview.');
    }
  } catch (error) {
    if (active !== session) return;
    ui.controls.hidden = true;
    message(error.name === 'PasswordException'
      ? 'This PDF is password-protected. Preview an unlocked copy, or keep this file as an attachment.'
      : 'This file could not be previewed. It may be damaged or use an unsupported format. It can still be attached to your email.');
  } finally {
    if (active === session) ui.content.setAttribute('aria-busy', 'false');
  }
}

async function renderPage(session, direction) {
  if (!session?.pdf || active !== session || session.rendering) return;
  session.page = Math.min(session.pdf.numPages, Math.max(1, session.page + direction));
  session.rendering = true;
  ui.previous.disabled = ui.next.disabled = true;
  ui.content.setAttribute('aria-busy', 'true');
  ui.page.textContent = `Page ${session.page} of ${session.pdf.numPages}`;
  try {
    const page = await session.pdf.getPage(session.page);
    if (active !== session) return;
    const original = page.getViewport({ scale: 1 });
    const width = Math.max(240, ui.content.clientWidth - 32);
    const scale = Math.min(2, width / original.width);
    const viewport = page.getViewport({ scale });
    // Bound canvas memory even for unusually tall PDF pages.
    const outputScale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(12_000_000 / (viewport.width * viewport.height)));
    const canvas = document.createElement('canvas');
    canvas.className = 'preview-pdf';
    canvas.width = Math.ceil(viewport.width * outputScale);
    canvas.height = Math.ceil(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = 'auto';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${session.file.name}, page ${session.page} of ${session.pdf.numPages}`);
    ui.content.replaceChildren(canvas);
    ui.content.scrollTop = 0;
    session.render = page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [outputScale, 0, 0, outputScale, 0, 0] });
    await session.render.promise;
    session.render = null;
  } catch (error) {
    if (active === session && error.name !== 'RenderingCancelledException') message('This PDF page could not be displayed. Try another page. Your original file can still be attached.');
  } finally {
    session.rendering = false;
    if (active === session) {
      ui.previous.disabled = session.page <= 1;
      ui.next.disabled = session.page >= session.pdf.numPages;
      ui.content.setAttribute('aria-busy', 'false');
    }
  }
}
