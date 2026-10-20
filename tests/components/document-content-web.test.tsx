import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocumentContent } from '@/components/document-content.web';

it('embeds the exact signed PDF inside My Account without an external viewer service', () => {
  const html = renderToStaticMarkup(
    <DocumentContent
      url="https://storage.example/file?signature=AbC%2F123"
      kind="pdf"
      title="Policy.pdf"
      onError={() => undefined}
    />
  );
  expect(html).toContain('<iframe');
  expect(html).toContain('src="https://storage.example/file?signature=AbC%2F123"');
  expect(html).toContain('referrerPolicy="no-referrer"');
  expect(html).toContain('title="Policy.pdf"');
});

it('embeds images in the same panel with an accessible description', () => {
  const html = renderToStaticMarkup(
    <DocumentContent
      url="https://storage.example/photo"
      kind="image"
      title="Policy photo"
      onError={() => undefined}
    />
  );
  expect(html).toContain('<img');
  expect(html).toContain('alt="Policy photo"');
});
