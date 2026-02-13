interface RichTextContentProps {
  content?: string | null;
  className?: string;
}

const RichTextContent = ({ content, className = '' }: RichTextContentProps) => {
  if (!content) return null;

  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  if (!isHtml) {
    return (
      <p className={`whitespace-pre-line ${className}`}>
        {content}
      </p>
    );
  }

  return (
    <div
      className={`rich-text-content ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default RichTextContent;
