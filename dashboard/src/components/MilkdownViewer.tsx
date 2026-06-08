import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

const components: Components = {
  // Task list checkbox
  input: ({ node, ...props }) => {
    if (props.type === 'checkbox') {
      return (
        <input
          {...props}
          disabled
          className="mr-1.5 mt-0.5 accent-blue-500"
        />
      )
    }
    return <input {...props} />
  },
  // Links open in new tab
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  // Code blocks — let highlight.js handle the styling
  pre: ({ children, ...props }) => (
    <pre {...props} className="rounded-lg overflow-x-auto !bg-gray-900 !p-4 my-4">
      {children}
    </pre>
  ),
  // Inline code
  code: ({ children, className, ...props }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return <code className={`${className} !bg-transparent !p-0 text-sm`} {...props}>{children}</code>
    }
    return (
      <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    )
  },
  // Tables
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border-collapse" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th className="bg-gray-50 border border-gray-200 px-3 py-2 text-left font-semibold" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-gray-200 px-3 py-2" {...props}>
      {children}
    </td>
  ),
  // Horizontal rule
  hr: () => <hr className="my-8 border-gray-200" />,
  // Images
  img: ({ src, alt, ...props }) => (
    <img src={src} alt={alt} className="rounded-lg shadow max-w-full my-4" loading="lazy" {...props} />
  ),
  // Blockquote
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-4 border-blue-400 bg-blue-50 px-4 py-2 my-4 italic text-gray-600 rounded-r" {...props}>
      {children}
    </blockquote>
  ),
}

export default function MilkdownViewer({ content }: { content: string }) {
  if (!content) return null

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, [rehypeKatex, { strict: false }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
