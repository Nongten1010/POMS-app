import { describe, expect, it } from '@jest/globals';
import { renderEmailTestHtml } from '../../src/modules/email-test/email-test.service';

describe('emailTestService helpers', () => {
  it('renders UTF-8 HTML and escapes message content', () => {
    const html = renderEmailTestHtml(
      'ทดสอบส่งเมล <script>alert("x")</script>',
      '2026-06-12T13:35:06.871Z',
      1,
    );

    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('ทดสอบส่งเมล');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});
