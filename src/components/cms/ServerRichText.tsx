/**
 * Server-rendered rich text. Content comes from admin-only writes
 * (RLS `is_admin()` on cms_copy / dashboard_content), so we skip the
 * DOMPurify client-side step here. For untrusted sources use
 * RichTextContent (client) instead.
 */
export default function ServerRichText({
  html,
  className = '',
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={`rich-text-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
