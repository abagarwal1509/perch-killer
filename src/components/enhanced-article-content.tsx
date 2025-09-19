'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { ContentProcessor, type ProcessedContent } from '@/lib/content-processor'

interface EnhancedArticleContentProps {
  content: string
  fallbackContent?: string
  baseUrl?: string
  className?: string
}

interface ImageProps {
  src?: string
  alt?: string
  title?: string
}

const OptimizedImage: React.FC<ImageProps> = ({ src, alt, title }) => {
  const [imageError, setImageError] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)

  if (!src || imageError) {
    return (
      <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 text-sm">
        {alt || 'Image unavailable'}
      </div>
    )
  }

  return (
    <div className="my-6">
      <img
        src={src}
        alt={alt || ''}
        title={title}
        className={`max-w-full h-auto rounded-lg shadow-sm transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setImageError(true)
          setIsLoading(false)
        }}
        loading="lazy"
      />
      {alt && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center italic">
          {alt}
        </p>
      )}
    </div>
  )
}

export const EnhancedArticleContent: React.FC<EnhancedArticleContentProps> = ({
  content,
  fallbackContent,
  baseUrl,
  className = ''
}) => {
  const processedContent = React.useMemo(() => {
    const processed = ContentProcessor.processContent(content, fallbackContent)
    
    // Fix image URLs if baseUrl provided
    if (baseUrl && processed.content) {
      processed.content = ContentProcessor.fixImageUrls(processed.content, baseUrl)
    }
    
    return processed
  }, [content, fallbackContent, baseUrl])

  if (!processedContent.content) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="mb-4">No content available for this article.</p>
        <p className="text-sm">RSS feeds sometimes only provide article summaries.</p>
      </div>
    )
  }

  if (processedContent.isMarkdown) {
    return (
      <div className={`prose prose-lg dark:prose-invert max-w-none ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            img: OptimizedImage as any,
            // Custom link handling
            a: ({ href, children, ...props }) => (
              <a
                href={href}
                target={href?.startsWith('http') ? '_blank' : undefined}
                rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="text-blue-600 dark:text-blue-400 hover:underline"
                {...props}
              >
                {children}
              </a>
            ),
            // Custom code block styling
            pre: ({ children, ...props }) => (
              <pre
                className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto text-sm"
                {...props}
              >
                {children}
              </pre>
            ),
            code: ({ children, className, ...props }) => {
              const isInline = !className
              return (
                <code
                  className={
                    isInline
                      ? 'bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm'
                      : className
                  }
                  {...props}
                >
                  {children}
                </code>
              )
            },
            // Enhanced blockquote styling
            blockquote: ({ children, ...props }) => (
              <blockquote
                className="border-l-4 border-blue-500 pl-6 my-6 text-gray-700 dark:text-gray-300 italic bg-blue-50 dark:bg-blue-900/20 py-4 rounded-r-lg"
                {...props}
              >
                {children}
              </blockquote>
            )
          }}
        >
          {processedContent.content}
        </ReactMarkdown>
      </div>
    )
  }

  // For HTML content, render with sanitization
  return (
    <div 
      className={`prose prose-lg dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent.content }}
    />
  )
}

export default EnhancedArticleContent
