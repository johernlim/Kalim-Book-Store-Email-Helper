'use strict';

const form = document.querySelector('#email-form');
const fileInput = document.querySelector('#document');
const fileInfo = document.querySelector('#file-info');
const status = document.querySelector('#status');

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileInfo.textContent = file
    ? `${file.name} · ${formatSize(file.size)} · Attach this file in Gmail.`
    : 'Choose a file from your computer.';
  status.replaceChildren();
});

function formatSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const recipient = document.querySelector('#email').value.trim();
  const title = document.querySelector('#title').value.trim();
  if (!title) {
    document.querySelector('#title').setCustomValidity('Enter an email title.');
    form.reportValidity();
    return;
  }
  const params = new URLSearchParams({ view: 'cm', fs: '1', to: recipient, su: title });
  const url = `https://mail.google.com/mail/?${params}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  status.replaceChildren(document.createTextNode(`Attach “${fileInput.files[0].name}” in Gmail, then press Send there. If Gmail did not open, `));
  const retryLink = document.createElement('a');
  retryLink.href = url;
  retryLink.target = '_blank';
  retryLink.rel = 'noopener noreferrer';
  retryLink.textContent = 'open your email here';
  status.append(retryLink, document.createTextNode('.'));
});

document.querySelector('#title').addEventListener('input', (event) => {
  event.target.setCustomValidity('');
});
